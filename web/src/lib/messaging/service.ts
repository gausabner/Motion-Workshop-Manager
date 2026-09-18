import "server-only";
import type { ContactMethod, MessageChannel, ShareKind, Tenant } from "@prisma/client";
import type { TenantContext } from "@/lib/auth/session";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";
import { getCustomerAccount } from "@/lib/payments/queries";
import { mintShareLink, shareUrl } from "@/lib/sharing/links";
import { driverFor } from "@/lib/messaging/drivers";
import { toInternational } from "@/lib/messaging/phone";
import { DEFAULT_MESSAGES, PURPOSE_KIND, emailSubject, ensureLink, purposeForDocument, type MessagePurpose } from "@/lib/messaging/templates";
import { renderTemplate, type MergeValues } from "@/lib/templates/merge";
import { documentValues, documentTitle, workshopValues } from "@/lib/templates/values";
import { dateShort, money } from "@/lib/format";

export type SendTarget =
    | { kind: "DOCUMENT"; id: string }
    | { kind: "PAYMENT"; id: string }
    | { kind: "STATEMENT"; customerId: string; from: string; to: string };

type Recipient = { id: string; name: string; mobile: string | null; email: string | null; preferredContact: ContactMethod };

type SendContext = {
    purpose: MessagePurpose;
    title: string;
    number: string | null;
    customer: Recipient;
    values: MergeValues;
    share: { kind: ShareKind; targetId: string; params?: Record<string, string> };
    documentId?: string;
    paymentId?: string;
};

const RECIPIENT = { id: true, firstName: true, lastName: true, mobile: true, email: true, preferredContact: true } as const;
const asRecipient = (c: { id: string; firstName: string; lastName: string; mobile: string | null; email: string | null; preferredContact: ContactMethod }): Recipient => ({
    id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), mobile: c.mobile, email: c.email, preferredContact: c.preferredContact,
});

/** Everything needed to word and address a message about one thing. Null when it is not ours or has nobody to send to. */
async function loadContext(db: TenantDb, tenant: Tenant, target: SendTarget): Promise<SendContext | null> {
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
        body: renderTemplate(ensureLink(body), { ...context.values, link: "{{link}}" }),
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
    const link = await db.$transaction((tx) =>
        mintShareLink(tx, { tenantId: tenant.id, kind: context.share.kind, targetId: context.share.targetId, params: context.share.params, createdById: membership.id }),
    );
    const url = shareUrl(origin, link.token);
    // Rendered against the full values again, so a field typed into the edit still resolves.
    const body = renderTemplate(ensureLink(input.body), { ...context.values, link: url });
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
                shareLinkId: link.id,
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
        // A document that went out means the customer has been told — the "Told" column.
        if (context.documentId && status !== "FAILED") await tx.document.update({ where: { id: context.documentId }, data: { contactedAt: new Date() } });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Message", entityId: row.id, action: "SENT", diff: { channel: input.channel, driver: driver.name, status } } });
        return row;
    });

    if (result.kind === "failed") return { ok: false, message: result.error };
    return result.kind === "handoff"
        ? { ok: true, status: "HANDED_OFF", url: result.url, messageId: message.id }
        : { ok: true, status: "SENT", url: null, messageId: message.id };
}
