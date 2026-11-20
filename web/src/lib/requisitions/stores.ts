import "server-only";
import { Prisma, type Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { fullName } from "@/lib/format";
import { recalculate } from "@/lib/documents/recalculate";
import { movesStock } from "@/lib/stock/rules";
import { fullyIssued, issueError, OPEN_STATES, partsStatus, type IssueLine } from "@/lib/requisitions/stores-rules";
import type { Actor } from "@/lib/requisitions/service";

/**
 * Stores issuing parts against an approved requisition, inside a transaction.
 *
 * Each handover is one `RequisitionIssue`: who handed over, who received
 * (by name and pay number, with or without a login), and one `ISSUE` stock
 * movement per line. When the requisition is charged to a job card, the parts
 * land on it at cost, marked with the requisition line, so processing the job
 * card or its invoice never takes them off the shelf again. Once every line
 * has had what it asked for, the requisition waits for its finalising
 * signatures.
 */

const MISSING = "This requisition no longer exists. Refresh the page.";
const text = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

/** What has been issued against each of a requisition's lines. Issues are negative movements, so the total is negated. */
export async function issuedByLine(tx: Pick<TenantTx, "stockMovement">, lineIds: string[]): Promise<Map<string, number>> {
    if (!lineIds.length) return new Map();
    const sums = await tx.stockMovement.groupBy({ by: ["requisitionLineId"], where: { requisitionLineId: { in: lineIds }, kind: "ISSUE" }, _sum: { quantity: true } });
    return new Map(sums.map((s) => [s.requisitionLineId!, -(s._sum.quantity?.toNumber() ?? 0)]));
}

export async function issueStores(
    tx: TenantTx,
    tenant: Tenant,
    actor: Actor,
    id: string,
    input: { lines: { lineId: string; quantity: number }[]; receiver: { membershipId: string | null; name?: string | null; payNumber?: string | null }; note?: string | null },
): Promise<{ state: "APPROVED" | "AWAITING_FINALISE" }> {
    if (!actor.canIssue) throw new Error("Only stores can issue parts.");
    await tx.$queryRaw`SELECT 1 FROM "Requisition" WHERE "id" = ${id} FOR UPDATE`;
    const req = await tx.requisition.findUnique({
        where: { id },
        select: {
            state: true, kind: true, number: true, chargeDocumentId: true,
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, product: { select: { id: true, type: true, isService: true, dontUpdateQty: true, costExTax: true, vatExempt: true } } } },
        },
    });
    if (!req) throw new Error(MISSING);

    // The receiver: a team member, whose name and pay number are copied as they stand, or a name and pay number typed in.
    let receiver = { membershipId: null as string | null, name: text(input.receiver.name) ?? "", payNumber: text(input.receiver.payNumber) };
    if (input.receiver.membershipId) {
        const m = await tx.membership.findFirst({ where: { id: input.receiver.membershipId, status: "ACTIVE" }, select: { id: true, payNumber: true, user: { select: { firstName: true, lastName: true } } } });
        if (!m) throw new Error("Choose the receiver from the team list again.");
        receiver = { membershipId: m.id, name: fullName(m.user), payNumber: m.payNumber };
    }

    const issued = await issuedByLine(tx, req.lines.map((l) => l.id));
    const lines: IssueLine[] = req.lines.map((l) => ({ id: l.id, description: l.description, quantity: l.quantity.toNumber(), issued: issued.get(l.id) ?? 0, stocked: movesStock(l.product) }));
    const problem = issueError({ state: req.state, kind: req.kind, lines, issue: input.lines, issuerId: actor.membershipId, receiver });
    if (problem) throw new Error(problem);

    const job = req.chargeDocumentId ? await tx.document.findUnique({ where: { id: req.chargeDocumentId }, select: { id: true, state: true, taxRate: true, _count: { select: { lines: true } } } }) : null;
    if (job && job.state !== "DRAFT") throw new Error("The job card it is charged to has been processed, so nothing more can be added to it. Ask for the requisition to be charged to an open job card.");

    const now = new Date();
    const handover = await tx.requisitionIssue.create({
        data: { tenantId: tenant.id, requisitionId: id, issuedById: actor.membershipId, receiverMembershipId: receiver.membershipId, receiverName: receiver.name, receiverPayNumber: receiver.payNumber, note: text(input.note), at: now },
        select: { id: true },
    });
    let order = job?._count.lines ?? 0;
    for (const want of input.lines.filter((i) => i.quantity > 0)) {
        const line = req.lines.find((l) => l.id === want.lineId)!;
        const product = line.product!;
        const quantity = new Prisma.Decimal(want.quantity);
        await tx.stockMovement.create({
            data: {
                tenantId: tenant.id, productId: product.id, kind: "ISSUE", quantity: quantity.negated(), unitCost: product.costExTax,
                documentId: job?.id ?? null, requisitionLineId: line.id, requisitionIssueId: handover.id, at: now, byId: actor.membershipId,
                note: req.number ? `Issued on ${req.number}` : null,
            },
        });
        await tx.product.update({ where: { id: product.id }, data: { qtyOnHand: { decrement: quantity } } });
        if (job) {
            // On the job card at cost: the council's own stores, not a sale.
            await tx.documentLine.create({
                data: {
                    tenantId: tenant.id, documentId: job.id, sortOrder: order++, productId: product.id, lineType: product.type,
                    description: line.description, quantity, unitPrice: product.costExTax, unitCost: product.costExTax,
                    vatRate: product.vatExempt ? 0 : job.taxRate, discountPercent: 0, requisitionLineId: line.id,
                },
            });
        }
    }
    if (job) await recalculate(tx, job.id);

    const after = lines.map((l) => ({ ...l, issued: l.issued + (input.lines.find((i) => i.lineId === l.id)?.quantity ?? 0) }));
    const done = fullyIssued(after);
    if (done) await tx.requisition.update({ where: { id }, data: { state: "AWAITING_FINALISE" } });
    if (job) await syncPartsStatus(tx, tenant, actor, job.id);
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "ISSUED", diff: { to: receiver.name, lines: input.lines.filter((i) => i.quantity > 0).length, complete: done } },
    });
    return { state: done ? "AWAITING_FINALISE" : "APPROVED" };
}

/**
 * Keep the job card's status in step with its requisitions: waiting for parts
 * while any is still to be met, back to work in progress when none is. The
 * change is logged like any other status change, by the person whose move
 * caused it.
 */
export async function syncPartsStatus(tx: TenantTx, tenant: Tenant, actor: Pick<Actor, "membershipId">, documentId: string | null): Promise<void> {
    if (!documentId) return;
    const [doc, open] = await Promise.all([
        tx.document.findUnique({ where: { id: documentId }, select: { jobStatus: true, state: true } }),
        tx.requisition.count({ where: { chargeDocumentId: documentId, state: { in: OPEN_STATES } } }),
    ]);
    if (!doc || doc.state === "VOID") return;
    const next = partsStatus(doc.jobStatus, open);
    if (!next) return;
    await tx.document.update({ where: { id: documentId }, data: { jobStatus: next } });
    await tx.documentStatusEvent.create({
        data: {
            tenantId: tenant.id, documentId, fromStatus: doc.jobStatus, toStatus: next, byId: actor.membershipId,
            comment: next === "WAITING_FOR_PARTS" ? "A requisition for parts is open." : "Every requisition for parts has been met.",
        },
    });
}
