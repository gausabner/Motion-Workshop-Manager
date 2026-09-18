"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { DocumentType, JobStatus } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { requireTenant, type TenantContext } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { type ActionState, fromZod, str } from "@/lib/forms";
import { saveDocumentSchema } from "@/lib/documents/schema";
import { calculateTotals } from "@/lib/documents/totals";
import { stateOnProcess } from "@/lib/documents/settlement";
import { TYPE_SEQUENCE } from "@/lib/documents/types";
import { allocateNumber } from "@/lib/documents/numbering";
import { businessToday } from "@/lib/tenant/today";
import { parseLocalDateTime } from "@/lib/diary/time";

/** Document types that put money on a customer's account when processed. */
const FINANCIAL = new Set<DocumentType>(["INVOICE", "CASH_SALE", "CREDIT"]);
/** Types that run on the workshop floor and therefore carry a job status. */
const JOB_LIKE = new Set<DocumentType>(["BOOKING", "JOB_CARD"]);

function editorPath(slug: string, id: string) {
    return `/${slug}/dashboard/documents/${id}`;
}

/** The tenant's tax settings as they stand now, to stamp onto a new document. */
function tenantTaxSnapshot(tenant: TenantContext["tenant"]) {
    return { taxName: tenant.taxName, taxRate: tenant.salesTaxRate, pricesIncludeTax: tenant.pricesIncludeTax };
}

/**
 * Recompute and store totals from the lines currently on the document.
 *
 * Tax settings come from the document's own snapshot, never from the tenant:
 * a workshop changing its VAT rate must not rewrite history.
 */
async function recalculate(tx: TenantTx, documentId: string) {
    const doc = await tx.document.findUniqueOrThrow({
        where: { id: documentId },
        select: {
            taxRate: true, pricesIncludeTax: true, discountPercent: true, discountAmount: true, freight: true,
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, unitCost: true, vatRate: true, discountPercent: true } },
        },
    });
    const totals = calculateTotals({
        pricesIncludeTax: doc.pricesIncludeTax,
        freightVatRate: doc.taxRate.toNumber(),
        discountPercent: doc.discountPercent?.toNumber() ?? null,
        discountAmount: doc.discountAmount.toNumber(),
        freight: doc.freight.toNumber(),
        lines: doc.lines.map((l) => ({
            quantity: l.quantity.toNumber(),
            unitPrice: l.unitPrice.toNumber(),
            unitCost: l.unitCost.toNumber(),
            vatRate: l.vatRate.toNumber(),
            discountPercent: l.discountPercent.toNumber(),
        })),
    });
    await tx.document.update({
        where: { id: documentId },
        data: {
            subtotal: totals.subtotal, discountApplied: totals.discountApplied, vatTotal: totals.vatTotal,
            unroundedTotal: totals.total, rounding: 0, total: totals.total,
            // The benchmark's trick: the first line names the job, so lists,
            // statements and messages can say "Cambelt and water pump" instead
            // of "INV-1003". Nothing types it; it follows line one.
            // Only when there is a line one: a booking made from a service has its
            // description before it has any lines, and must not lose it on save.
            description: doc.lines[0] ? doc.lines[0].description.slice(0, 120) : undefined,
        },
    });
    // The per-line figures are stored too, so margin and sales reporting can sum
    // them in SQL. Nothing customer-facing reads them — a printed invoice derives
    // its own — but a column that exists must not be allowed to lie.
    for (const [index, line] of doc.lines.entries()) {
        const computed = totals.lines[index];
        if (!computed) continue;
        await tx.documentLine.update({
            where: { id: line.id },
            data: { lineSubtotal: computed.lineSubtotal, vatAmount: computed.vatAmount, lineTotal: computed.lineTotal },
        });
    }
    return totals;
}

async function loadEditable(ctx: TenantContext, id: string) {
    const doc = await ctx.db.document.findUnique({ where: { id }, select: { id: true, type: true, state: true, jobStatus: true, vehicleId: true, customerId: true, number: true, jobNumber: true } });
    return doc;
}

// ───────────────────────── create ─────────────────────────

export async function createDocument(
    slug: string,
    type: DocumentType,
    seed?: { customerId?: string; vehicleId?: string; scheduledAt?: string; mechanicId?: string; estimatedHours?: number },
): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const { db, tenant, membership, user } = ctx;

    const created = await db.$transaction(async (tx) => {
        const jobNumber = JOB_LIKE.has(type) ? await allocateNumber(tx, tenant.id, "JOB") : null;
        const doc = await tx.document.create({
            data: {
                tenantId: tenant.id,
                type,
                state: "DRAFT",
                jobStatus: JOB_LIKE.has(type) ? "BOOKED_IN" : null,
                jobNumber,
                customerId: seed?.customerId || null,
                vehicleId: seed?.vehicleId || null,
                postDate: businessToday(tenant.timezone),
                // Seeds arrive as wall-clock text from the diary, read in the workshop's zone.
                scheduledAt: seed?.scheduledAt ? parseLocalDateTime(seed.scheduledAt, tenant.timezone) : null,
                mechanicId: seed?.mechanicId || null,
                estimatedHours: seed?.estimatedHours ?? null,
                isCashSale: type === "CASH_SALE",
                serviceAdvisorId: membership.isServiceAdvisor ? membership.id : null,
                createdById: membership.id,
                paymentTermsDays: tenant.defaultPaymentTermsDays,
                ...tenantTaxSnapshot(tenant),
            },
            select: { id: true },
        });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: doc.id, action: "CREATED", diff: { type } } });
        return doc;
    });

    revalidatePath(`/${slug}/dashboard/transactions`);
    redirect(editorPath(slug, created.id));
}

// ───────────────────────── save ─────────────────────────

export async function saveDocument(slug: string, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const { db, tenant, membership, user } = ctx;

    const existing = await loadEditable(ctx, id);
    if (!existing) return { ok: false, message: "Document not found." };
    if (existing.state !== "DRAFT") return { ok: false, message: "This document has been processed and can no longer be edited." };

    let linesRaw: unknown = [];
    try {
        linesRaw = JSON.parse((formData.get("lines") as string) || "[]");
    } catch {
        return { ok: false, message: "The line items could not be read. Reload the page and try again." };
    }

    const parsed = saveDocumentSchema.safeParse({
        customerId: str(formData, "customerId"),
        isCashSale: formData.get("isCashSale") === "on",
        vehicleId: str(formData, "vehicleId"),
        serviceAdvisorId: str(formData, "serviceAdvisorId"),
        mechanicId: str(formData, "mechanicId"),
        reference: str(formData, "reference"),
        customerOrderNumber: str(formData, "customerOrderNumber"),
        postDate: str(formData, "postDate"),
        dueDate: str(formData, "dueDate"),
        followUpDate: str(formData, "followUpDate"),
        scheduledAt: str(formData, "scheduledAt"),
        estimatedHours: str(formData, "estimatedHours"),
        odometer: str(formData, "odometer"),
        nextServiceKm: str(formData, "nextServiceKm"),
        nextServiceDate: str(formData, "nextServiceDate"),
        jobStatus: str(formData, "jobStatus"),
        statusComment: str(formData, "statusComment"),
        isInternal: formData.get("isInternal") === "on",
        paymentTermsDays: str(formData, "paymentTermsDays"),
        discountPercent: str(formData, "discountPercent"),
        discountAmount: str(formData, "discountAmount"),
        freight: str(formData, "freight"),
        eventNotes: str(formData, "eventNotes"),
        jobCardNotes: str(formData, "jobCardNotes"),
        invoiceNotes: str(formData, "invoiceNotes"),
        description: str(formData, "description"),
        lines: linesRaw,
    });
    if (!parsed.success) return fromZod(parsed.error);
    const d = parsed.data;

    if (!d.isCashSale && existing.type !== "CASH_SALE" && !d.customerId) {
        return { ok: false, errors: { customerId: ["Choose a customer, or mark this as a cash sale"] } };
    }
    if (d.customerId) {
        const c = await db.customer.findUnique({ where: { id: d.customerId }, select: { id: true } });
        if (!c) return { ok: false, errors: { customerId: ["Customer not found"] } };
    }
    if (d.vehicleId) {
        const v = await db.vehicle.findUnique({ where: { id: d.vehicleId }, select: { id: true } });
        if (!v) return { ok: false, errors: { vehicleId: ["Vehicle not found"] } };
    }

    const statusChanged = d.jobStatus && d.jobStatus !== existing.jobStatus;

    await db.$transaction(async (tx) => {
        await tx.document.update({
            where: { id },
            data: {
                customerId: d.customerId || null,
                isCashSale: d.isCashSale,
                vehicleId: d.vehicleId || null,
                serviceAdvisorId: d.serviceAdvisorId || null,
                mechanicId: d.mechanicId || null,
                reference: d.reference ?? null,
                customerOrderNumber: d.customerOrderNumber ?? null,
                postDate: d.postDate ?? undefined,
                dueDate: d.dueDate ?? null,
                followUpDate: d.followUpDate ?? null,
                scheduledAt: d.scheduledAt ? parseLocalDateTime(d.scheduledAt, tenant.timezone) : null,
                estimatedHours: d.estimatedHours ?? null,
                odometer: d.odometer ?? null,
                nextServiceKm: d.nextServiceKm ?? null,
                nextServiceDate: d.nextServiceDate ?? null,
                jobStatus: d.jobStatus ?? existing.jobStatus,
                statusComment: d.statusComment ?? null,
                isInternal: d.isInternal,
                paymentTermsDays: d.paymentTermsDays ?? null,
                discountPercent: d.discountPercent ?? null,
                discountAmount: d.discountAmount ?? 0,
                freight: d.freight ?? 0,
                eventNotes: d.eventNotes ?? null,
                jobCardNotes: d.jobCardNotes ?? null,
                invoiceNotes: d.invoiceNotes ?? null,
                ...(d.description ? { description: d.description } : {}),
            },
        });

        // Replace the line set: delete what the editor dropped, update the rest, insert new rows.
        const keptIds = d.lines.map((l) => l.id).filter((v): v is string => !!v);
        await tx.documentLine.deleteMany({ where: { documentId: id, ...(keptIds.length ? { id: { notIn: keptIds } } : {}) } });
        for (const [index, line] of d.lines.entries()) {
            const data = {
                sortOrder: index,
                productId: line.productId || null,
                lineType: line.lineType,
                description: line.description,
                quantity: line.quantity,
                hours: line.hours ?? null,
                unitPrice: line.unitPrice,
                unitCost: line.unitCost,
                vatRate: line.vatRate,
                discountPercent: line.discountPercent,
                serialNumbers: line.serialNumbers || null,
                isCustomerSupplied: line.isCustomerSupplied,
            };
            if (line.id) {
                await tx.documentLine.update({ where: { id: line.id }, data });
            } else {
                await tx.documentLine.create({ data: { ...data, tenantId: tenant.id, documentId: id } });
            }
        }

        if (statusChanged && d.jobStatus) {
            await tx.documentStatusEvent.create({
                data: { tenantId: tenant.id, documentId: id, fromStatus: existing.jobStatus, toStatus: d.jobStatus, comment: d.statusComment ?? null, byId: membership.id },
            });
        }
        await recalculate(tx, id);
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: id, action: "UPDATED" } });
    });

    revalidatePath(editorPath(slug, id));
    revalidatePath(`/${slug}/dashboard/transactions`);
    revalidatePath(`/${slug}/dashboard/jobs`);
    return { ok: true, message: "Saved" };
}

// ───────────────────────── lifecycle ─────────────────────────

/** Post the document: assign its number, lock the lines, update the vehicle's service record. */
export async function processDocument(slug: string, id: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:process");
    const { db, tenant, membership, user } = ctx;

    const doc = await db.document.findUnique({
        where: { id },
        select: { id: true, type: true, state: true, customerId: true, isCashSale: true, vehicleId: true, odometer: true, nextServiceKm: true, nextServiceDate: true, postDate: true, dueDate: true, paymentTermsDays: true, _count: { select: { lines: true } } },
    });
    if (!doc) throw new Error("Document not found");
    if (doc.state !== "DRAFT") throw new Error("Only a draft can be processed");
    if (doc._count.lines === 0) throw new Error("Add at least one line before processing");
    if (!doc.customerId && !doc.isCashSale) throw new Error("Choose a customer, or mark this as a cash sale");

    await db.$transaction(async (tx) => {
        const totals = await recalculate(tx, id);
        const number = await allocateNumber(tx, tenant.id, TYPE_SEQUENCE[doc.type]);
        const terms = doc.paymentTermsDays ?? tenant.defaultPaymentTermsDays;
        const dueDate = doc.dueDate ?? new Date(doc.postDate.getTime() + terms * 24 * 60 * 60 * 1000);

        await tx.document.update({
            where: { id },
            data: {
                number,
                state: stateOnProcess(doc.type, totals.total),
                processedAt: new Date(),
                processedById: membership.id,
                dueDate: FINANCIAL.has(doc.type) ? dueDate : null,
                jobStatus: JOB_LIKE.has(doc.type) ? undefined : null,
            },
        });

        // The invoice is what updates the vehicle's service record (PRD VEH-04).
        if (doc.vehicleId && FINANCIAL.has(doc.type) && doc.type !== "CREDIT") {
            await tx.vehicle.update({
                where: { id: doc.vehicleId },
                data: {
                    odometer: doc.odometer ?? undefined,
                    lastInDate: doc.postDate,
                    lastServiceDate: doc.postDate,
                    nextServiceKm: doc.nextServiceKm ?? undefined,
                    nextServiceDate: doc.nextServiceDate ?? undefined,
                },
            });
        }

        await tx.auditEvent.create({
            data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: id, action: "PROCESSED", diff: { number, total: totals.total } },
        });
    });

    revalidatePath(editorPath(slug, id));
    revalidatePath(`/${slug}/dashboard/transactions`);
    redirect(`${editorPath(slug, id)}?processed=1`);
}

/** Reverse a processed document. The number is kept so the sequence stays auditable. */
export async function voidDocument(slug: string, id: string, formData: FormData): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:void");
    const { db, tenant, user } = ctx;
    const reason = (formData.get("voidReason") as string | null)?.trim();
    if (!reason) throw new Error("A reason is required to void a document");

    const doc = await db.document.findUnique({ where: { id }, select: { state: true } });
    if (!doc) throw new Error("Document not found");
    if (doc.state === "VOID") throw new Error("Already voided");
    // Derived, not stored: any posted payment allocated here blocks the void.
    const allocated = await db.paymentAllocation.aggregate({ where: { documentId: id, payment: { state: "PROCESSED" } }, _sum: { amount: true } });
    if ((allocated._sum.amount?.toNumber() ?? 0) !== 0) throw new Error("Payments are allocated to this document — refund or reallocate them first");

    await db.$transaction(async (tx) => {
        await tx.document.update({ where: { id }, data: { state: "VOID", voidedAt: new Date(), voidReason: reason, jobStatus: null } });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: id, action: "VOIDED", diff: { reason } } });
    });

    revalidatePath(editorPath(slug, id));
    revalidatePath(`/${slug}/dashboard/transactions`);
    redirect(editorPath(slug, id));
}

/** Copy a document's header and lines into a new draft of `toType`. */
async function cloneInto(ctx: TenantContext, sourceId: string, toType: DocumentType, opts: { link: boolean; negate?: boolean }): Promise<string> {
    const { db, tenant, membership, user } = ctx;
    const source = await db.document.findUnique({ where: { id: sourceId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
    if (!source) throw new Error("Document not found");

    const created = await db.$transaction(async (tx) => {
        const jobNumber = JOB_LIKE.has(toType) ? (source.jobNumber ?? (await allocateNumber(tx, tenant.id, "JOB"))) : source.jobNumber;
        const doc = await tx.document.create({
            data: {
                tenantId: tenant.id,
                type: toType,
                state: "DRAFT",
                jobStatus: JOB_LIKE.has(toType) ? (source.jobStatus ?? "BOOKED_IN") : null,
                jobNumber,
                customerId: source.customerId,
                isCashSale: source.isCashSale,
                vehicleId: source.vehicleId,
                serviceAdvisorId: source.serviceAdvisorId ?? (membership.isServiceAdvisor ? membership.id : null),
                mechanicId: source.mechanicId,
                reference: source.reference,
                customerOrderNumber: source.customerOrderNumber,
                postDate: businessToday(tenant.timezone),
                scheduledAt: source.scheduledAt,
                estimatedHours: source.estimatedHours,
                odometer: source.odometer,
                nextServiceKm: source.nextServiceKm,
                nextServiceDate: source.nextServiceDate,
                isInternal: source.isInternal,
                paymentTermsDays: source.paymentTermsDays,
                // A credit note must reverse the tax that was charged; a conversion or copy is a new transaction at today's rate.
                ...(opts.negate ? { taxName: source.taxName, taxRate: source.taxRate, pricesIncludeTax: source.pricesIncludeTax } : tenantTaxSnapshot(tenant)),
                discountPercent: source.discountPercent,
                discountAmount: source.discountAmount,
                freight: source.freight,
                eventNotes: source.eventNotes,
                jobCardNotes: source.jobCardNotes,
                invoiceNotes: source.invoiceNotes,
                createdById: membership.id,
                sourceDocumentId: opts.link ? source.id : null,
            },
            select: { id: true },
        });
        for (const [index, l] of source.lines.entries()) {
            await tx.documentLine.create({
                data: {
                    tenantId: tenant.id,
                    documentId: doc.id,
                    sortOrder: index,
                    productId: l.productId,
                    lineType: l.lineType,
                    description: l.description,
                    quantity: opts.negate ? l.quantity.toNumber() * -1 : l.quantity,
                    unitPrice: l.unitPrice,
                    unitCost: l.unitCost,
                    hours: l.hours,
                    // Standard-rated lines follow the new document's rate; exempt and special-rate lines keep theirs.
                    vatRate: !opts.negate && l.vatRate.equals(source.taxRate) ? tenant.salesTaxRate : l.vatRate,
                    discountPercent: l.discountPercent,
                    serialNumbers: l.serialNumbers,
                    isCustomerSupplied: l.isCustomerSupplied,
                },
            });
        }
        await recalculate(tx, doc.id);
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: doc.id, action: "CREATED", diff: { from: source.id, toType } } });
        return doc;
    });
    return created.id;
}

/** Booking → job card, quote → job card, job card → invoice (PRD DOC-04). */
export async function convertDocument(slug: string, id: string, toType: DocumentType): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const newId = await cloneInto(ctx, id, toType, { link: true });
    revalidatePath(`/${slug}/dashboard/transactions`);
    revalidatePath(`/${slug}/dashboard/jobs`);
    redirect(editorPath(slug, newId));
}

export async function copyDocument(slug: string, id: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const source = await ctx.db.document.findUnique({ where: { id }, select: { type: true } });
    if (!source) throw new Error("Document not found");
    const newId = await cloneInto(ctx, id, source.type, { link: false });
    redirect(editorPath(slug, newId));
}

/** A credit note mirroring a processed invoice, with the quantities negated. */
export async function createCreditNote(slug: string, id: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const source = await ctx.db.document.findUnique({ where: { id }, select: { state: true, type: true } });
    if (!source) throw new Error("Document not found");
    if (source.state !== "PROCESSED" || !["INVOICE", "CASH_SALE"].includes(source.type)) {
        throw new Error("Only a processed invoice can be credited");
    }
    const newId = await cloneInto(ctx, id, "CREDIT", { link: true, negate: true });
    redirect(editorPath(slug, newId));
}

/** Move a job between board columns (PRD DOC-03), recording who moved it. */
export async function setJobStatus(slug: string, id: string, status: JobStatus, comment?: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const { db, tenant, membership, user } = ctx;

    const doc = await db.document.findUnique({ where: { id }, select: { jobStatus: true, state: true } });
    if (!doc) throw new Error("Document not found");
    if (doc.state !== "DRAFT") throw new Error("This document is no longer open");
    if (doc.jobStatus === status) return;

    await db.$transaction(async (tx) => {
        await tx.document.update({ where: { id }, data: { jobStatus: status, statusComment: comment ?? undefined } });
        await tx.documentStatusEvent.create({ data: { tenantId: tenant.id, documentId: id, fromStatus: doc.jobStatus, toStatus: status, comment: comment ?? null, byId: membership.id } });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: id, action: "STATUS_CHANGED", diff: { from: doc.jobStatus, to: status } } });
    });

    revalidatePath(`/${slug}/dashboard/jobs`);
    revalidatePath(editorPath(slug, id));
}

/** Record that the customer was contacted about this document (PRD TXN-02). */
export async function markContacted(slug: string, id: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    await ctx.db.document.update({ where: { id }, data: { contactedAt: new Date() } });
    revalidatePath(`/${slug}/dashboard/transactions`);
    revalidatePath(editorPath(slug, id));
}
