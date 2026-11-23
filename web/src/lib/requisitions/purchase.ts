import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { movesStock } from "@/lib/stock/rules";
import { mintShareLink } from "@/lib/sharing/links";
import { requisitionValue } from "@/lib/requisitions/rules";
import { fullyIssued, type IssueLine } from "@/lib/requisitions/stores-rules";
import { orderError, pricedFromQuote, shortfall, splitError } from "@/lib/requisitions/purchase-rules";
import { quoteHandler, type Actor } from "@/lib/requisitions/service";
import { syncPartsStatus } from "@/lib/requisitions/stores";
import { issuedByLine, movedByLine, orderedByLine } from "@/lib/requisitions/counts";

/**
 * Buying what stores cannot issue, inside transactions: stores splits what it
 * cannot meet into a numbered purchase requisition; suppliers are asked for
 * quotations by a link; the approved requisition becomes a purchase order at
 * the chosen quotation's price; and what the supplier invoice brings in is
 * read back here, line by line, so it can be handed over.
 *
 * Receiving stays where it is: a supplier invoice against the order. That is
 * what puts stock on the shelf and records the real cost, and a purchase
 * requisition reads it rather than keeping a second count.
 */

const MISSING = "This requisition no longer exists. Refresh the page.";
/**
 * Stores turns what it cannot meet into a purchase requisition: all of an
 * item it does not keep, and what the shelf is short of on the rest. The new
 * one is numbered now, asks for the same thing for the same job, and is the
 * requester's, as the need is theirs; it is submitted once its quotations are
 * in. The stores requisition stops waiting for what was moved: if nothing of
 * it is left to issue, it goes to be finalised for what it did issue, or
 * closes if it issued nothing.
 */
export async function splitToPurchase(tx: TenantTx, tenant: Tenant, actor: Actor, id: string): Promise<{ id: string; number: string }> {
    if (!actor.canIssue) throw new Error("Only stores splits a requisition into a purchase.");
    await tx.$queryRaw`SELECT 1 FROM "Requisition" WHERE "id" = ${id} FOR UPDATE`;
    const req = await tx.requisition.findUnique({
        where: { id },
        select: {
            kind: true, state: true, number: true, requestedById: true, workshopId: true, location: true, requiredBy: true, purpose: true, chargeDocumentId: true, chargeVoteId: true,
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, productId: true, itemCode: true, description: true, quantity: true, unitCost: true, note: true, product: { select: { type: true, isService: true, dontUpdateQty: true, qtyOnHand: true } } } },
        },
    });
    if (!req) throw new Error(MISSING);
    const ids = req.lines.map((l) => l.id);
    const [issued, moved] = await Promise.all([issuedByLine(tx, ids), movedByLine(tx, ids)]);
    const lines: IssueLine[] = req.lines.map((l) => ({
        id: l.id, description: l.description, quantity: l.quantity.toNumber(), issued: issued.get(l.id) ?? 0, moved: moved.get(l.id) ?? 0,
        stocked: movesStock(l.product), onHand: l.product ? l.product.qtyOnHand.toNumber() : null,
    }));
    const short = shortfall(lines);
    const problem = splitError({ kind: req.kind, state: req.state, short: short.length });
    if (problem) throw new Error(problem);

    const number = await allocateNumber(tx, tenant.id, "REQUISITION");
    const bought = short.map((s, sortOrder) => {
        const l = req.lines.find((x) => x.id === s.lineId)!;
        return { sortOrder, productId: l.productId, itemCode: l.itemCode, description: l.description, quantity: s.quantity, unitCost: l.unitCost.toNumber(), note: l.note, sourceLineId: l.id };
    });
    const created = await tx.requisition.create({
        data: {
            tenantId: tenant.id, number, kind: "PURCHASE", state: "DRAFT", requestedById: req.requestedById, workshopId: req.workshopId, location: req.location,
            requiredBy: req.requiredBy, purpose: req.number ? `For ${req.number}${req.purpose ? `: ${req.purpose}` : ""}` : req.purpose,
            chargeDocumentId: req.chargeDocumentId, chargeVoteId: req.chargeVoteId, sourceRequisitionId: id, value: requisitionValue(bought),
            lines: { create: bought.map((b) => ({ ...b, tenantId: tenant.id })) },
        },
        select: { id: true },
    });

    // What is left of the stores requisition, now the shortfall is bought instead.
    const after = lines.map((l) => ({ ...l, moved: (l.moved ?? 0) + (short.find((s) => s.lineId === l.id)?.quantity ?? 0) }));
    if (fullyIssued(after)) {
        const issuedAny = lines.some((l) => l.issued > 0);
        await tx.requisition.update({ where: { id }, data: issuedAny ? { state: "AWAITING_FINALISE" } : { state: "CLOSED", closedAt: new Date() } });
    }
    await tx.auditEvent.createMany({
        data: [
            { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "SPLIT", diff: { to: number, lines: short.length } },
            { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: created.id, action: "RAISED_FROM", diff: { from: req.number } },
        ],
    });
    await syncPartsStatus(tx, tenant, actor, req.chargeDocumentId);
    return { id: created.id, number };
}

/**
 * Ask suppliers for a price: one link each, to the request without prices,
 * for the hand-off to email. Opening the link is how MOTION knows it reached
 * them. Thirty days: a quotation that takes longer is a new request.
 */
export async function requestQuotes(tx: TenantTx, tenant: Tenant, actor: Actor, id: string, supplierIds: string[]): Promise<{ supplierId: string; name: string; email: string; token: string }[]> {
    await quoteHandler(tx, actor, id);
    if (!supplierIds.length) throw new Error("Choose at least one supplier to ask.");
    const suppliers = await tx.supplier.findMany({ where: { id: { in: supplierIds }, archivedAt: null }, select: { id: true, companyName: true, email: true } });
    if (suppliers.length !== new Set(supplierIds).size) throw new Error("One of those suppliers is no longer on the list. Refresh the page.");
    const noEmail = suppliers.find((s) => !s.email?.trim());
    if (noEmail) throw new Error(`${noEmail.companyName} has no email address. Add one on the supplier, or ask them by phone and attach their quotation.`);
    const out: { supplierId: string; name: string; email: string; token: string }[] = [];
    for (const s of suppliers) {
        const link = await mintShareLink(tx, { tenantId: tenant.id, kind: "QUOTATION_REQUEST", targetId: id, params: { supplierId: s.id }, createdById: actor.membershipId, days: 30 });
        out.push({ supplierId: s.id, name: s.companyName, email: s.email!.trim(), token: link.token });
    }
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "QUOTES_REQUESTED", diff: { suppliers: suppliers.map((s) => s.companyName) } } });
    return out;
}

/**
 * The approved purchase requisition becomes a purchase order to the chosen
 * supplier, priced at what they quoted. Each order line points at the
 * requisition line it buys, and at the job it is for. It is raised ready to
 * send, from the order's own page, as every order is.
 */
export async function orderFromRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string): Promise<{ id: string; number: string }> {
    if (!actor.canIssue) throw new Error("Only stores raises the purchase order.");
    await tx.$queryRaw`SELECT 1 FROM "Requisition" WHERE "id" = ${id} FOR UPDATE`;
    const req = await tx.requisition.findUnique({
        where: { id },
        select: {
            kind: true, state: true, number: true, requiredBy: true, chargeDocumentId: true,
            quotes: { where: { chosen: true }, select: { supplierId: true, amount: true, reference: true } },
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, productId: true, itemCode: true, description: true, quantity: true, unitCost: true } },
        },
    });
    if (!req) throw new Error(MISSING);
    const ordered = await orderedByLine(tx, req.lines.map((l) => l.id));
    const chosen = req.quotes[0] ?? null;
    const problem = orderError({ kind: req.kind, state: req.state, chosen: !!chosen, ordered: [...ordered.values()].some((q) => q > 0) });
    if (problem) throw new Error(problem);

    const prices = pricedFromQuote(req.lines.map((l) => ({ quantity: l.quantity.toNumber(), unitCost: l.unitCost.toNumber() })), chosen!.amount.toNumber());
    const number = await allocateNumber(tx, tenant.id, "PURCHASE_ORDER");
    const order = await tx.purchaseOrder.create({
        data: {
            tenantId: tenant.id, number, supplierId: chosen!.supplierId, state: "SUGGESTED", orderDate: new Date(), dueDate: req.requiredBy,
            reference: chosen!.reference, note: req.number ? `For requisition ${req.number}` : null, createdById: actor.membershipId,
            taxName: tenant.taxName, taxRate: tenant.purchaseTaxRate, pricesIncludeTax: false,
            lines: {
                create: req.lines.map((l, i) => ({
                    tenantId: tenant.id, sortOrder: i, productId: l.productId, itemCode: l.itemCode, description: l.description, quantity: l.quantity, unitCost: prices[i],
                    documentId: req.chargeDocumentId, dueDate: req.requiredBy, requisitionLineId: l.id,
                })),
            },
        },
        select: { id: true },
    });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "ORDERED", diff: { order: number } } });
    return { id: order.id, number };
}
