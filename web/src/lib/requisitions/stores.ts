import "server-only";
import { Prisma, type Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { fullName } from "@/lib/format";
import { recalculate } from "@/lib/documents/recalculate";
import { movesStock } from "@/lib/stock/rules";
import { fullyIssued, issueError, OPEN_STATES, partsStatus, type IssueLine } from "@/lib/requisitions/stores-rules";
import type { Actor } from "@/lib/requisitions/service";
import { issuedByLine, movedByLine, receivedByLine } from "@/lib/requisitions/counts";

/**
 * Stores handing parts over against an approved requisition, inside a
 * transaction: from the shelf on a stores requisition, and on a purchase
 * requisition, what the supplier has delivered for it.
 *
 * Each handover is one `RequisitionIssue`: who handed over, who received
 * (by name and pay number, with or without a login), and one line per item.
 * A stock item's line has the `ISSUE` movement that took it off the shelf; an
 * item bought for the job and handed over as it arrived has none. When the
 * requisition is charged to a job card, the parts land on it at cost, marked
 * with the requisition line, so processing the job card or its invoice never
 * takes them off the shelf again. Once every line has had what it asked for,
 * the requisition waits for its finalising signatures.
 */

const MISSING = "This requisition no longer exists. Refresh the page.";
const text = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

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
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, unitCost: true, productId: true } },
        },
    });
    if (!req) throw new Error(MISSING);
    // The shelf counts are read under lock, so two storemen issuing the last of an item cannot both hand it over.
    const productIds = [...new Set(req.lines.map((l) => l.productId).filter((p): p is string => !!p))];
    if (productIds.length) await tx.$queryRaw`SELECT 1 FROM "Product" WHERE "id" IN (${Prisma.join(productIds)}) FOR UPDATE`;
    const products = new Map(
        (await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, type: true, isService: true, dontUpdateQty: true, costExTax: true, vatExempt: true, qtyOnHand: true } })).map((p) => [p.id, p]),
    );
    const productOf = (l: { productId: string | null }) => (l.productId ? (products.get(l.productId) ?? null) : null);

    // The storeman's own name and pay number, kept on the handover as the form's "verified by".
    const me = await tx.membership.findUniqueOrThrow({ where: { id: actor.membershipId }, select: { payNumber: true, user: { select: { firstName: true, lastName: true } } } });
    const issuer = { membershipId: actor.membershipId, name: fullName(me.user), payNumber: me.payNumber };

    // The receiver: a team member, whose name and pay number are copied as they stand, or a name and pay number typed in.
    let receiver = { membershipId: null as string | null, name: text(input.receiver.name) ?? "", payNumber: text(input.receiver.payNumber) };
    if (input.receiver.membershipId) {
        const m = await tx.membership.findFirst({ where: { id: input.receiver.membershipId, status: "ACTIVE" }, select: { id: true, payNumber: true, user: { select: { firstName: true, lastName: true } } } });
        if (!m) throw new Error("Choose the receiver from the team list again.");
        receiver = { membershipId: m.id, name: fullName(m.user), payNumber: m.payNumber };
    }

    const ids = req.lines.map((l) => l.id);
    const bought = req.kind === "PURCHASE";
    const [issued, moved, received] = await Promise.all([issuedByLine(tx, ids), bought ? new Map<string, number>() : movedByLine(tx, ids), bought ? receivedByLine(tx, ids) : new Map<string, { quantity: number; unitCost: number }>()]);
    const lines: IssueLine[] = req.lines.map((l) => {
        const product = productOf(l);
        return {
            id: l.id, description: l.description, quantity: l.quantity.toNumber(), issued: issued.get(l.id) ?? 0, moved: moved.get(l.id) ?? 0, received: received.get(l.id)?.quantity ?? 0,
            stocked: movesStock(product), onHand: product ? product.qtyOnHand.toNumber() : null,
        };
    });
    const problem = issueError({ state: req.state, kind: req.kind, lines, issue: input.lines, issuer, receiver });
    if (problem) throw new Error(problem);

    const job = req.chargeDocumentId ? await tx.document.findUnique({ where: { id: req.chargeDocumentId }, select: { id: true, state: true, taxRate: true, _count: { select: { lines: true } } } }) : null;
    if (job && job.state !== "DRAFT") throw new Error("The job card it is charged to has been processed, so nothing more can be added to it. Ask for the requisition to be charged to an open job card.");

    const now = new Date();
    const handover = await tx.requisitionIssue.create({
        data: { tenantId: tenant.id, requisitionId: id, issuedById: actor.membershipId, issuedByName: issuer.name, issuedByPayNumber: issuer.payNumber, receiverMembershipId: receiver.membershipId, receiverName: receiver.name, receiverPayNumber: receiver.payNumber, note: text(input.note), at: now },
        select: { id: true },
    });
    let order = job?._count.lines ?? 0;
    for (const want of input.lines.filter((i) => i.quantity > 0)) {
        const line = req.lines.find((l) => l.id === want.lineId)!;
        const product = productOf(line);
        const stocked = movesStock(product);
        const quantity = new Prisma.Decimal(want.quantity);
        // At cost: the shelf's cost for a stock item, what the supplier charged for an item bought in.
        const unitCost = stocked ? product!.costExTax : new Prisma.Decimal(received.get(line.id)?.unitCost ?? line.unitCost.toNumber());
        let movementId: string | null = null;
        if (stocked) {
            const movement = await tx.stockMovement.create({
                data: {
                    tenantId: tenant.id, productId: product!.id, kind: "ISSUE", quantity: quantity.negated(), unitCost,
                    documentId: job?.id ?? null, requisitionLineId: line.id, requisitionIssueId: handover.id, at: now, byId: actor.membershipId,
                    note: req.number ? `Issued on ${req.number}` : null,
                },
                select: { id: true },
            });
            movementId = movement.id;
            await tx.product.update({ where: { id: product!.id }, data: { qtyOnHand: { decrement: quantity } } });
        }
        await tx.requisitionIssueLine.create({ data: { tenantId: tenant.id, issueId: handover.id, requisitionLineId: line.id, quantity, unitCost, stockMovementId: movementId } });
        if (job) {
            // On the job card at cost: the council's own stores, not a sale.
            await tx.documentLine.create({
                data: {
                    tenantId: tenant.id, documentId: job.id, sortOrder: order++, productId: product?.id ?? null, lineType: product?.type ?? "STOCK",
                    description: line.description, quantity, unitPrice: unitCost, unitCost,
                    vatRate: product?.vatExempt ? 0 : job.taxRate, discountPercent: 0, requisitionLineId: line.id,
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
        // Open, or split off and still gathering its quotations: either way the job waits for it.
        tx.requisition.count({ where: { chargeDocumentId: documentId, OR: [{ state: { in: OPEN_STATES } }, { state: "DRAFT", sourceRequisitionId: { not: null } }] } }),
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
