import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { recalculate } from "@/lib/documents/recalculate";
import { decisionError, stateAfterDecisions, toConvert } from "@/lib/inspections/rules";

/**
 * Inspections, inside transactions (R5). Plain module, so it runs against a
 * real database in a check; the server actions are auth and redirects.
 */

const toNumber = (d: { toNumber(): number } | null) => (d ? d.toNumber() : null);

/** Start an inspection on a job, copying the template's items so later template edits cannot rewrite it. */
export async function createInspection(tx: TenantTx, tenant: Tenant, membershipId: string, input: { documentId: string; templateId: string }) {
    const doc = await tx.document.findUnique({ where: { id: input.documentId }, select: { id: true, type: true, state: true, customerId: true, vehicleId: true, odometer: true } });
    if (!doc) throw new Error("That job is no longer there");
    if (doc.type !== "BOOKING" && doc.type !== "JOB_CARD") throw new Error("Inspections are done on a booking or job card");
    if (doc.state === "VOID") throw new Error("That job was voided");

    const template = await tx.inspectionTemplate.findUnique({ where: { id: input.templateId }, select: { id: true, name: true, items: { orderBy: { ordering: "asc" } } } });
    if (!template) throw new Error("That inspection template is no longer there");

    const number = await allocateNumber(tx, tenant.id, "INSPECTION");
    const inspection = await tx.inspection.create({
        data: {
            tenantId: tenant.id, number, state: "DRAFT", documentId: doc.id, customerId: doc.customerId, vehicleId: doc.vehicleId,
            templateId: template.id, mechanicId: membershipId, description: template.name, odometer: doc.odometer,
        },
        select: { id: true },
    });
    for (const item of template.items) {
        await tx.inspectionItem.create({
            data: {
                tenantId: tenant.id, inspectionId: inspection.id, templateItemId: item.id, group: item.group, ordering: item.ordering,
                description: item.description, inputLabels: item.inputLabels ?? [], productId: item.productId,
                // The template's usual price, so the mechanic only types the exceptions.
                estimate: item.defaultEstimate,
            },
        });
    }
    // Inspecting is a job status of its own on the board.
    await tx.document.updateMany({ where: { id: doc.id, jobStatus: { in: ["BOOKED_IN", "WORK_IN_PROGRESS"] } }, data: { jobStatus: "INSPECTION_IN_PROGRESS" } });
    return { id: inspection.id, number };
}

export type ItemPatch = {
    id: string;
    checked?: boolean;
    urgent?: boolean;
    soon?: boolean;
    inputs?: (string | null)[];
    comment?: string | null;
    estimate?: number | null;
};

/** Findings are edited while the inspection is a draft; once it is with the customer, it holds still. */
export async function saveItems(tx: TenantTx, inspectionId: string, patches: ItemPatch[]): Promise<void> {
    const inspection = await tx.inspection.findUnique({ where: { id: inspectionId }, select: { state: true } });
    if (!inspection) throw new Error("That inspection is no longer there");
    if (inspection.state !== "DRAFT") throw new Error("This inspection has been sent to the customer. Take it back to draft to change it.");
    for (const p of patches) {
        const clean = (v: string | null | undefined) => (v == null ? null : v.trim().slice(0, 60) || null);
        await tx.inspectionItem.updateMany({
            where: { id: p.id, inspectionId },
            data: {
                ...(p.checked !== undefined ? { checked: p.checked } : {}),
                ...(p.urgent !== undefined ? { urgent: p.urgent } : {}),
                ...(p.soon !== undefined ? { soon: p.soon } : {}),
                ...(p.inputs ? { input1: clean(p.inputs[0]), input2: clean(p.inputs[1]), input3: clean(p.inputs[2]), input4: clean(p.inputs[3]) } : {}),
                ...(p.comment !== undefined ? { comment: p.comment?.trim().slice(0, 500) || null } : {}),
                ...(p.estimate !== undefined ? { estimate: p.estimate === null || !Number.isFinite(p.estimate) ? null : Math.max(0, Math.round(p.estimate * 100) / 100) } : {}),
                // Any flag or reading means someone looked at it.
                ...(p.urgent || p.soon || p.inputs?.some(Boolean) ? { checked: true } : {}),
            },
        });
    }
}

/** Put it to the customer. There has to be something to put. */
export async function requestApproval(tx: TenantTx, inspectionId: string): Promise<void> {
    const inspection = await tx.inspection.findUnique({ where: { id: inspectionId }, select: { state: true, documentId: true, items: { select: { urgent: true, soon: true } } } });
    if (!inspection) throw new Error("That inspection is no longer there");
    if (inspection.state !== "DRAFT") throw new Error("This inspection has already been sent");
    if (!inspection.items.some((i) => i.urgent || i.soon)) throw new Error("Nothing is marked red or amber, so there is nothing to approve. Finalise it instead.");
    await tx.inspection.update({ where: { id: inspectionId }, data: { state: "REQUESTED", requestedAt: new Date() } });
    if (inspection.documentId) {
        await tx.document.updateMany({ where: { id: inspection.documentId, jobStatus: { not: null } }, data: { jobStatus: "WAITING_FOR_CUSTOMER_APPROVAL" } });
    }
}

/** Back to draft, to change a finding. Answers already given on unchanged items are kept. */
export async function reopen(tx: TenantTx, inspectionId: string): Promise<void> {
    const inspection = await tx.inspection.findUnique({ where: { id: inspectionId }, select: { state: true } });
    if (!inspection) throw new Error("That inspection is no longer there");
    if (inspection.state === "FINALISED") throw new Error("A finalised inspection cannot be reopened");
    await tx.inspection.update({ where: { id: inspectionId }, data: { state: "DRAFT" } });
}

/**
 * One answer on one finding — from the customer's phone, or taken by phone at
 * the counter. The inspection's state follows from all the answers.
 */
export async function decide(tx: TenantTx, inspectionId: string, itemId: string, answer: "approve" | "decline" | "clear", by: string) {
    // One decision at a time per inspection, so two taps cannot race the state.
    await tx.$queryRaw`SELECT id FROM "Inspection" WHERE id = ${inspectionId} FOR UPDATE`;
    const inspection = await tx.inspection.findUnique({ where: { id: inspectionId }, select: { state: true, items: true } });
    if (!inspection) throw new Error("That inspection is no longer there");
    const item = inspection.items.find((i) => i.id === itemId);
    if (!item) throw new Error("That finding is not on this inspection");
    const problem = decisionError(inspection.state, { ...item, estimate: toNumber(item.estimate) });
    if (problem) throw new Error(problem);

    const now = new Date();
    const data =
        answer === "approve" ? { approvedAt: now, approvedBy: by, declinedAt: null } :
        answer === "decline" ? { declinedAt: now, approvedAt: null, approvedBy: by } :
        { approvedAt: null, declinedAt: null, approvedBy: null };
    await tx.inspectionItem.update({ where: { id: itemId }, data });

    const items = inspection.items.map((i) => (i.id === itemId ? { ...i, ...data } : i)).map((i) => ({ ...i, estimate: toNumber(i.estimate) }));
    const state = stateAfterDecisions(inspection.state, items);
    if (state !== inspection.state) {
        await tx.inspection.update({ where: { id: inspectionId }, data: { state } });
        // The customer has answered everything: the job is no longer waiting on them.
        const settled = state === "APPROVED" || state === "REFUSED";
        const job = (await tx.inspection.findUnique({ where: { id: inspectionId }, select: { documentId: true } }))?.documentId;
        if (job) {
            await tx.document.updateMany({
                where: settled ? { id: job, jobStatus: "WAITING_FOR_CUSTOMER_APPROVAL" } : { id: job, jobStatus: { in: ["WORK_IN_PROGRESS", "INSPECTION_IN_PROGRESS"] } },
                data: { jobStatus: settled ? "WORK_IN_PROGRESS" : "WAITING_FOR_CUSTOMER_APPROVAL" },
            });
        }
    }
    return { state };
}

/**
 * Put the approved findings on the job card, at the price the customer said
 * yes to. Each finding records the line it became, so running this twice adds
 * nothing twice — that line is the audit trail from "approved" to "charged".
 */
export async function addApprovedToJob(tx: TenantTx, inspectionId: string): Promise<{ added: number; documentId: string }> {
    const inspection = await tx.inspection.findUnique({
        where: { id: inspectionId },
        select: { tenantId: true, documentId: true, items: { orderBy: { ordering: "asc" }, include: { product: { select: { id: true, type: true, costExTax: true, vatExempt: true } } } } },
    });
    if (!inspection?.documentId) throw new Error("This inspection is not attached to a job");
    const doc = await tx.document.findUnique({ where: { id: inspection.documentId }, select: { id: true, state: true, taxRate: true, _count: { select: { lines: true } } } });
    if (!doc) throw new Error("That job is no longer there");
    if (doc.state !== "DRAFT") throw new Error("The job has been processed, so its lines are locked. Add the work to a new job card.");

    const items = toConvert(inspection.items.map((i) => ({ ...i, estimate: toNumber(i.estimate) })));
    let order = doc._count.lines;
    for (const item of items) {
        const product = inspection.items.find((i) => i.id === item.id)?.product ?? null;
        const line = await tx.documentLine.create({
            data: {
                tenantId: inspection.tenantId,
                documentId: doc.id,
                sortOrder: order++,
                productId: product?.id ?? null,
                lineType: product?.type ?? "LABOUR",
                description: item.comment ? `${item.description} — ${item.comment}` : item.description,
                quantity: 1,
                unitPrice: item.estimate ?? 0,
                unitCost: product?.costExTax ?? 0,
                vatRate: product?.vatExempt ? 0 : doc.taxRate,
                discountPercent: 0,
            },
            select: { id: true },
        });
        await tx.inspectionItem.update({ where: { id: item.id }, data: { documentLineId: line.id } });
    }
    if (items.length) await recalculate(tx, doc.id);
    return { added: items.length, documentId: doc.id };
}

export async function finalise(tx: TenantTx, inspectionId: string): Promise<void> {
    const inspection = await tx.inspection.findUnique({ where: { id: inspectionId }, select: { state: true, documentId: true, items: { select: { approvedAt: true, documentLineId: true, urgent: true, soon: true, declinedAt: true } } } });
    if (!inspection) throw new Error("That inspection is no longer there");
    if (inspection.state === "FINALISED") return;
    if (inspection.state === "REQUESTED") throw new Error("The customer has not answered every finding yet.");
    if (inspection.items.some((i) => i.approvedAt && !i.documentLineId)) throw new Error("Add the approved work to the job card first.");
    await tx.inspection.update({ where: { id: inspectionId }, data: { state: "FINALISED", finalisedAt: new Date() } });
    if (inspection.documentId) {
        await tx.document.updateMany({ where: { id: inspection.documentId, jobStatus: { in: ["INSPECTION_IN_PROGRESS", "WAITING_FOR_CUSTOMER_APPROVAL"] } }, data: { jobStatus: "WORK_IN_PROGRESS" } });
    }
}


/**
 * A decision, and — when it is a yes and the job is still open — the work
 * straight onto the job card. The workshop is waiting on that yes to start;
 * making someone at the counter notice it and press a button would only add
 * the wait back.
 */
export async function decideAndBook(tx: TenantTx, inspectionId: string, itemId: string, answer: "approve" | "decline" | "clear", by: string) {
    const result = await decide(tx, inspectionId, itemId, answer, by);
    let added = 0;
    if (answer === "approve") {
        const inspection = await tx.inspection.findUnique({ where: { id: inspectionId }, select: { document: { select: { state: true } } } });
        if (inspection?.document?.state === "DRAFT") added = (await addApprovedToJob(tx, inspectionId)).added;
    }
    return { ...result, added };
}
