import "server-only";
import type { ContactMethod, MessageChannel, ReminderKind, ShareKind, Tenant } from "@prisma/client";
import type { TenantContext } from "@/lib/auth/session";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";
import { getCustomerAccount } from "@/lib/payments/queries";
import { mintShareLink, shareUrl } from "@/lib/sharing/links";
import { driverFor } from "@/lib/messaging/drivers";
import { toInternational } from "@/lib/messaging/phone";
import { DEFAULT_MESSAGES, PURPOSE_KIND, PURPOSE_LABELS, emailSubject, ensureLink, purposeForDocument, type MessagePurpose } from "@/lib/messaging/templates";
import { renderTemplate, type MergeValues } from "@/lib/templates/merge";
import { documentValues, documentTitle, workshopValues } from "@/lib/templates/values";
import { dateShort, money } from "@/lib/format";
import { onlineBookingSettings } from "@/lib/settings/schema";
import { toZoned } from "@/lib/diary/time";

export type SendTarget =
    | { kind: "DOCUMENT"; id: string }
    | { kind: "INSPECTION"; id: string }
    | { kind: "PAYMENT"; id: string }
    | { kind: "STATEMENT"; customerId: string; from: string; to: string }
    /** `targetId` is the vehicle for service/licence/roadworthy, the document for booking/quote; `dueOn` is the key date. */
    | { kind: "REMINDER"; reminder: ReminderKind; targetId: string; dueOn: string };

type Recipient = { id: string; name: string; mobile: string | null; email: string | null; preferredContact: ContactMethod };

type SendContext = {
    purpose: MessagePurpose;
    title: string;
    number: string | null;
    customer: Recipient;
    values: MergeValues;
    /** A link minted per message to the thing itself. Absent for reminders about a date rather than a document. */
    share?: { kind: ShareKind; targetId: string; params?: Record<string, string> };
    /** A fixed page to link instead, such as the online booking page. */
    staticPath?: string;
    documentId?: string;
    paymentId?: string;
    reminder?: { kind: ReminderKind; targetId: string; dueOn: string; vehicleId?: string };
};

const REMINDER_PURPOSE: Record<ReminderKind, MessagePurpose> = {
    SERVICE_DUE: "REMINDER_SERVICE",
    LICENCE_DISC: "REMINDER_LICENCE",
    ROADWORTHY: "REMINDER_ROADWORTHY",
    BOOKING: "REMINDER_BOOKING",
    QUOTE_FOLLOW_UP: "REMINDER_QUOTE",
};

const VEHICLE_DATE = { SERVICE_DUE: "nextServiceDate", LICENCE_DISC: "licenceExpiry", ROADWORTHY: "roadworthyExpiry" } as const;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const vehicleText = (v: { year: number | null; make: string; model: string } | null) => (v ? [v.year, v.make, v.model].filter(Boolean).join(" ") : "");

/**
 * A reminder, checked against the data as it is now: a service date that has
 * moved, a booking that was rescheduled or a quote that became a job no longer
 * matches, so a stale list cannot send a stale message.
 */
async function loadReminderContext(db: TenantDb, tenant: Tenant, target: Extract<SendTarget, { kind: "REMINDER" }>): Promise<SendContext | null> {
    // The target arrives from the browser: check its shape before trusting any of it.
    if (!Object.hasOwn(REMINDER_PURPOSE, target.reminder) || !/^\d{4}-\d{2}-\d{2}$/.test(target.dueOn)) return null;
    const purpose = REMINDER_PURPOSE[target.reminder];
    const base = { purpose, title: PURPOSE_LABELS[purpose], number: null, reminder: { kind: target.reminder, targetId: target.targetId, dueOn: target.dueOn } };

    if (target.reminder === "SERVICE_DUE" || target.reminder === "LICENCE_DISC" || target.reminder === "ROADWORTHY") {
        const field = VEHICLE_DATE[target.reminder];
        const vehicle = await db.vehicle.findUnique({
            where: { id: target.targetId },
            select: { id: true, plate: true, make: true, model: true, year: true, nextServiceDate: true, licenceExpiry: true, roadworthyExpiry: true, customer: { select: RECIPIENT } },
        });
        const date = vehicle?.[field];
        if (!vehicle?.customer || !date || isoDay(date) !== target.dueOn) return null;
        return {
            ...base,
            customer: asRecipient(vehicle.customer),
            values: {
                ...workshopValues(tenant),
                customer_name: `${vehicle.customer.firstName} ${vehicle.customer.lastName}`.trim(),
                customer_first_name: vehicle.customer.firstName,
                vehicle: vehicleText(vehicle),
                plate: vehicle.plate,
                due_date: dateShort(date),
                next_service_date: vehicle.nextServiceDate ? dateShort(vehicle.nextServiceDate) : "",
            },
            staticPath: onlineBookingSettings(tenant.settings).enabled ? `/${tenant.slug}/book` : undefined,
            reminder: { ...base.reminder, vehicleId: vehicle.id },
        };
    }

    const doc = await db.document.findUnique({
        where: { id: target.targetId },
        select: {
            id: true, type: true, state: true, number: true, jobNumber: true, scheduledAt: true, contactedAt: true, total: true,
            customer: { select: RECIPIENT },
            vehicle: { select: { id: true, plate: true, make: true, model: true, year: true } },
        },
    });
    if (!doc?.customer || doc.state === "VOID") return null;
    const shared = {
        customer: asRecipient(doc.customer),
        share: { kind: "DOCUMENT" as const, targetId: doc.id },
        documentId: doc.id,
        number: doc.number ?? doc.jobNumber,
    };
    const values = {
        ...workshopValues(tenant),
        customer_name: `${doc.customer.firstName} ${doc.customer.lastName}`.trim(),
        customer_first_name: doc.customer.firstName,
        vehicle: vehicleText(doc.vehicle),
        plate: doc.vehicle?.plate ?? "",
        document_number: doc.number ?? doc.jobNumber ?? "",
        total: money(doc.total.toNumber(), tenant.currency),
    };

    if (target.reminder === "BOOKING") {
        if (doc.type !== "BOOKING" && doc.type !== "JOB_CARD") return null;
        if (doc.state !== "DRAFT" || !doc.scheduledAt || toZoned(doc.scheduledAt, tenant.timezone).day !== target.dueOn) return null;
        const when = new Intl.DateTimeFormat("en-GB", { timeZone: tenant.timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(doc.scheduledAt);
        return { ...base, ...shared, values: { ...values, document_title: "Booking", scheduled_at: when } };
    }

    if (doc.type !== "QUOTE" || !doc.contactedAt || toZoned(doc.contactedAt, tenant.timezone).day !== target.dueOn) return null;
    const converted = await db.document.count({ where: { sourceDocumentId: doc.id, state: { not: "VOID" } } });
    if (converted > 0) return null;
    return { ...base, ...shared, values: { ...values, document_title: "Quote" } };
}

const RECIPIENT = { id: true, firstName: true, lastName: true, mobile: true, email: true, preferredContact: true } as const;
const asRecipient = (c: { id: string; firstName: string; lastName: string; mobile: string | null; email: string | null; preferredContact: ContactMethod }): Recipient => ({
    id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), mobile: c.mobile, email: c.email, preferredContact: c.preferredContact,
});

/** Everything needed to word and address a message about one thing. Null when it is not ours or has nobody to send to. */
async function loadContext(db: TenantDb, tenant: Tenant, target: SendTarget): Promise<SendContext | null> {
    if (target.kind === "REMINDER") return loadReminderContext(db, tenant, target);
    if (target.kind === "DOCUMENT") {
        const doc = await db.document.findUnique({
            where: { id: target.id },
            select: {
                id: true, type: true, number: true, jobNumber: true, postDate: true, dueDate: true, scheduledAt: true, odometer: true,
                nextServiceKm: true, nextServiceDate: true, total: true,
                customer: { select: RECIPIENT },
                vehicle: { select: { plate: true, make: true, model: true, year: true } },
                allocations: { where: { payment: { state: "PROCESSED" } }, select: { amount: true } },
            },
        });
        if (!doc?.customer) return null;
        const paid = round2(doc.allocations.reduce((sum, a) => sum + a.amount.toNumber(), 0));
        return {
            purpose: purposeForDocument(doc.type),
            title: documentTitle(doc.type, tenant.vatNumber),
            number: doc.number ?? doc.jobNumber,
            customer: asRecipient(doc.customer),
            values: documentValues(tenant, { ...doc, total: doc.total.toNumber() }, paid),
            share: { kind: "DOCUMENT", targetId: doc.id },
            documentId: doc.id,
        };
    }

    if (target.kind === "INSPECTION") {
        const inspection = await db.inspection.findUnique({
            where: { id: target.id },
            select: {
                id: true, number: true, state: true, documentId: true,
                customer: { select: RECIPIENT },
                vehicle: { select: { plate: true, make: true, model: true, year: true } },
                items: { select: { urgent: true, soon: true, estimate: true } },
            },
        });
        // A draft has nothing settled to ask about yet.
        if (!inspection?.customer || inspection.state === "DRAFT") return null;
        const sum = (flag: "urgent" | "soon") => inspection.items.filter((i) => (flag === "urgent" ? i.urgent : !i.urgent && i.soon)).reduce((t, i) => t + (i.estimate?.toNumber() ?? 0), 0);
        const urgent = sum("urgent");
        const soon = sum("soon");
        return {
            purpose: "INSPECTION",
            title: "Inspection",
            number: inspection.number,
            customer: asRecipient(inspection.customer),
            values: {
                ...workshopValues(tenant),
                customer_name: `${inspection.customer.firstName} ${inspection.customer.lastName}`.trim(),
                customer_first_name: inspection.customer.firstName,
                vehicle: inspection.vehicle ? [inspection.vehicle.year, inspection.vehicle.make, inspection.vehicle.model].filter(Boolean).join(" ") : "",
                plate: inspection.vehicle?.plate ?? "",
                document_title: "Inspection",
                document_number: inspection.number ?? "",
                // Blank when there is none, so the line drops out of the message.
                urgent_total: urgent > 0 ? money(urgent, tenant.currency) : "",
                soon_total: soon > 0 ? money(soon, tenant.currency) : "",
            },
            share: { kind: "INSPECTION", targetId: inspection.id },
            documentId: inspection.documentId ?? undefined,
        };
    }

    if (target.kind === "PAYMENT") {
        const payment = await db.payment.findUnique({
            where: { id: target.id },
            select: { id: true, number: true, direction: true, state: true, postDate: true, amount: true, customer: { select: RECIPIENT } },
        });
        if (!payment?.customer || payment.state !== "PROCESSED") return null;
        const title = payment.direction === "REFUND" ? "Refund" : "Receipt";
        return {
            purpose: payment.direction === "REFUND" ? "REFUND" : "RECEIPT",
            title,
            number: payment.number,
            customer: asRecipient(payment.customer),
            values: {
                ...workshopValues(tenant),
                customer_name: `${payment.customer.firstName} ${payment.customer.lastName}`.trim(),
                customer_first_name: payment.customer.firstName,
                document_title: title,
                document_number: payment.number ?? "",
                document_date: dateShort(payment.postDate),
                total: money(Math.abs(payment.amount.toNumber()), tenant.currency),
            },
            share: { kind: "PAYMENT", targetId: payment.id },
            paymentId: payment.id,
        };
    }

    const customer = await db.customer.findUnique({ where: { id: target.customerId }, select: RECIPIENT });
    if (!customer) return null;
    const account = await getCustomerAccount(db, customer.id);
    return {
        purpose: "STATEMENT",
        title: "Statement",
        number: null,
        customer: asRecipient(customer),
        values: {
            ...workshopValues(tenant),
            customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
            customer_first_name: customer.firstName,
            document_title: "Statement",
            account_balance: money(account.netOwing, tenant.currency),
        },
        share: { kind: "STATEMENT", targetId: customer.id, params: { from: target.from, to: target.to } },
    };
}

/** The workshop's own wording for this purpose, or ours when they have not written any. */
export async function wordingFor(db: TenantDb, purpose: MessagePurpose): Promise<{ body: string; custom: boolean }> {
    const template = await db.template.findFirst({ where: { kind: PURPOSE_KIND[purpose], active: true }, orderBy: { sortOrder: "asc" }, select: { body: true } });
    return template ? { body: template.body, custom: true } : { body: DEFAULT_MESSAGES[purpose], custom: false };
}

export type Draft = {
    channel: MessageChannel;
    recipient: string;
    subject: string | null;
    body: string;
    customerName: string;
    warnings: string[];
};

/**
 * The message as it will go out, for a person to read and edit before it does.
 * `{{link}}` is left in place: the link is minted at the moment of sending, so
 * an abandoned draft never leaves a live link behind.
 */
export async function draftMessage(db: TenantDb, tenant: Tenant, target: SendTarget, channel: MessageChannel): Promise<Draft | null> {
    const context = await loadContext(db, tenant, target);
    if (!context) return null;
    const { body } = await wordingFor(db, context.purpose);
    const warnings: string[] = [];

    let recipient = "";
    if (channel === "WHATSAPP") {
        recipient = toInternational(context.customer.mobile, tenant.country) ?? "";
        if (!recipient) warnings.push(context.customer.mobile ? `${context.customer.mobile} does not look like a mobile number WhatsApp can reach.` : "There is no mobile number on this customer.");
    } else {
        recipient = context.customer.email ?? "";
        if (!recipient) warnings.push("There is no email address on this customer.");
    }
    if (context.customer.preferredContact === "OPT_OUT") warnings.push(`${context.customer.name} has opted out of messages. Only send this if they asked for it.`);

    return {
        channel,
        recipient,
        subject: channel === "EMAIL" ? emailSubject(context.title, context.number, tenant.name) : null,
        // With nothing to link, {{link}} resolves empty and its line drops out.
        body: renderTemplate(context.share ? ensureLink(body) : body, { ...context.values, link: context.share || context.staticPath ? "{{link}}" : "" }),
        customerName: context.customer.name,
        warnings,
    };
}

export type SendOutcome =
    | { ok: true; status: "HANDED_OFF" | "SENT"; url: string | null; messageId: string }
    | { ok: false; message: string };

export async function sendMessage(
    ctx: TenantContext,
    origin: string,
    input: { target: SendTarget; channel: MessageChannel; recipient: string; subject?: string | null; body: string },
): Promise<SendOutcome> {
    const { db, tenant, membership, user } = ctx;
    const context = await loadContext(db, tenant, input.target);
    if (!context) return { ok: false, message: "There is nothing here to send, or nobody to send it to." };

    const recipient = input.channel === "WHATSAPP" ? toInternational(input.recipient, tenant.country) : input.recipient.trim();
    if (!recipient) return { ok: false, message: "That is not a number WhatsApp can reach." };
    if (!input.body.trim()) return { ok: false, message: "The message is empty." };

    const driver = driverFor(input.channel);
    const share = context.share;
    const link = share
        ? await db.$transaction((tx) => mintShareLink(tx, { tenantId: tenant.id, kind: share.kind, targetId: share.targetId, params: share.params, createdById: membership.id }))
        : null;
    const url = link && share ? shareUrl(origin, link.token, share.kind) : context.staticPath ? `${origin.replace(/\/$/, "")}${context.staticPath}` : "";
    // Rendered against the full values again, so a field typed into the edit still resolves.
    const body = renderTemplate(share ? ensureLink(input.body) : input.body, { ...context.values, link: url });
    const subject = input.channel === "EMAIL" ? input.subject?.trim() || emailSubject(context.title, context.number, tenant.name) : null;

    const result = await driver.send({ channel: input.channel, recipient, subject: subject ?? undefined, body });
    const status = result.kind === "handoff" ? "HANDED_OFF" : result.kind === "sent" ? "SENT" : "FAILED";

    const message = await db.$transaction(async (tx) => {
        const row = await tx.message.create({
            data: {
                tenantId: tenant.id,
                customerId: context.customer.id,
                documentId: context.documentId ?? null,
                paymentId: context.paymentId ?? null,
                shareLinkId: link?.id ?? null,
                channel: input.channel,
                driver: driver.name,
                status,
                recipient,
                subject,
                body,
                externalId: result.kind === "sent" ? result.externalId : null,
                error: result.kind === "failed" ? result.error : null,
                sentById: membership.id,
            },
            select: { id: true },
        });
        // A document that went out means the customer has been told — the "Told" column. Not for a reminder:
        // a quote's sent date is what its follow-up is keyed on, and moving it would start the follow-up over.
        if (context.documentId && status !== "FAILED" && !context.reminder) await tx.document.update({ where: { id: context.documentId }, data: { contactedAt: new Date() } });
        if (context.reminder && status !== "FAILED") {
            const r = context.reminder;
            const dueOn = new Date(`${r.dueOn}T00:00:00Z`);
            const data = { outcome: "SENT" as const, messageId: row.id, actedById: membership.id, actedAt: new Date() };
            await tx.reminder.upsert({
                where: { tenantId_kind_targetId_dueOn: { tenantId: tenant.id, kind: r.kind, targetId: r.targetId, dueOn } },
                create: { tenantId: tenant.id, kind: r.kind, targetId: r.targetId, dueOn, customerId: context.customer.id, vehicleId: r.vehicleId ?? null, documentId: context.documentId ?? null, ...data },
                update: data,
            });
        }
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Message", entityId: row.id, action: "SENT", diff: { channel: input.channel, driver: driver.name, status } } });
        return row;
    });

    if (result.kind === "failed") return { ok: false, message: result.error };
    return result.kind === "handoff"
        ? { ok: true, status: "HANDED_OFF", url: result.url, messageId: message.id }
        : { ok: true, status: "SENT", url: null, messageId: message.id };
}
