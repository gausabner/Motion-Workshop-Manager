import "server-only";
import { Prisma, type DocumentType, type StockMovementKind } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { movesStock, postsStock } from "@/lib/stock/rules";

/**
 * The stock ledger. Movements are the record; `Product.qtyOnHand` is a running
 * total kept beside them for lists, and `recount` rebuilds it from the
 * movements — so a wrong number can always be explained and corrected, rather
 * than only overwritten.
 */

const KIND: Record<"out" | "in", StockMovementKind> = { out: "SALE", in: "CREDIT" };

export type StockWarning = { itemCode: string; description: string; onHand: number };

/**
 * Post a processed document's lines to the ledger. Idempotent per line: a line
 * that has already moved stock is skipped, and the unique key on
 * (documentLineId, kind) is the backstop if two posts ever race.
 *
 * Returns the products this pushed below zero. Selling stock the system thinks
 * you do not have is allowed — a workshop often has the part in its hand
 * before the paperwork — but it is said out loud rather than passed over.
 */
export async function postDocumentStock(
    tx: TenantTx,
    tenantId: string,
    doc: { id: string; type: DocumentType; postDate: Date },
    membershipId: string | null,
): Promise<StockWarning[]> {
    if (!postsStock(doc.type)) return [];
    const lines = await tx.documentLine.findMany({
        where: { documentId: doc.id, productId: { not: null } },
        select: {
            id: true, quantity: true, unitCost: true,
            product: { select: { id: true, itemCode: true, description: true, type: true, isService: true, dontUpdateQty: true, qtyOnHand: true } },
        },
    });

    const warnings: StockWarning[] = [];
    // Which lines have already moved stock, asked up front: inside a transaction a failed
    // insert aborts everything that follows, so a unique-constraint clash cannot be caught
    // and shrugged off — it has to be avoided.
    const already = new Set(
        (await tx.stockMovement.findMany({
            where: { documentLineId: { in: lines.map((l) => l.id) }, kind: { in: ["SALE", "CREDIT"] } },
            select: { documentLineId: true },
        })).map((m) => m.documentLineId),
    );

    for (const line of lines) {
        const product = line.product;
        if (!movesStock(product) || already.has(line.id)) continue;
        // The opposite of the line: a sale of 3 takes 3 off the shelf, a credit of -1 puts 1 back.
        const quantity = new Prisma.Decimal(line.quantity).negated();
        if (quantity.isZero()) continue;
        await tx.stockMovement.create({
            data: {
                tenantId, productId: product!.id, kind: doc.type === "CREDIT" ? KIND.in : KIND.out, quantity, unitCost: line.unitCost,
                documentId: doc.id, documentLineId: line.id, at: doc.postDate, byId: membershipId,
            },
        });
        const updated = await tx.product.update({ where: { id: product!.id }, data: { qtyOnHand: { increment: quantity } }, select: { qtyOnHand: true } });
        if (updated.qtyOnHand.lessThan(0)) warnings.push({ itemCode: product!.itemCode, description: product!.description, onHand: updated.qtyOnHand.toNumber() });
    }
    return warnings;
}

/** Voiding a document puts the stock back the way it was, as new rows — the original movements stay as history. */
export async function reverseDocumentStock(tx: TenantTx, tenantId: string, documentId: string, membershipId: string | null): Promise<number> {
    const posted = await tx.stockMovement.findMany({
        where: { documentId, kind: { in: ["SALE", "CREDIT"] } },
        select: { id: true, productId: true, quantity: true, unitCost: true, documentLineId: true },
    });
    let reversed = 0;
    for (const movement of posted) {
        const already = await tx.stockMovement.count({ where: { documentLineId: movement.documentLineId, kind: "VOID_REVERSAL" } });
        if (already > 0) continue;
        const quantity = new Prisma.Decimal(movement.quantity).negated();
        await tx.stockMovement.create({
            data: {
                tenantId, productId: movement.productId, kind: "VOID_REVERSAL", quantity, unitCost: movement.unitCost,
                documentId, documentLineId: movement.documentLineId, note: "Document voided", byId: membershipId,
            },
        });
        await tx.product.update({ where: { id: movement.productId }, data: { qtyOnHand: { increment: quantity } } });
        reversed++;
    }
    return reversed;
}

/** A hand correction: someone counted the shelf, or wrote stock off. */
export async function adjustStock(
    tx: TenantTx,
    tenantId: string,
    input: { productId: string; quantity: number; kind: Extract<StockMovementKind, "ADJUSTMENT" | "STOCKTAKE" | "OPENING">; unitCost?: number; note: string; membershipId: string | null },
): Promise<number> {
    if (!Number.isFinite(input.quantity) || input.quantity === 0) throw new Error("Give a quantity to add or take away.");
    const product = await tx.product.findUnique({ where: { id: input.productId }, select: { id: true, costExTax: true } });
    if (!product) throw new Error("That product is no longer there.");
    await tx.stockMovement.create({
        data: {
            tenantId, productId: product.id, kind: input.kind, quantity: input.quantity,
            unitCost: input.unitCost ?? product.costExTax, note: input.note.trim().slice(0, 200) || null, byId: input.membershipId,
        },
    });
    const updated = await tx.product.update({ where: { id: product.id }, data: { qtyOnHand: { increment: input.quantity } }, select: { qtyOnHand: true } });
    return updated.qtyOnHand.toNumber();
}

/** Rebuild one product's running total from its movements, and say whether it had drifted. */
export async function recount(tx: TenantTx, productId: string): Promise<{ was: number; now: number }> {
    const [product, sum] = await Promise.all([
        tx.product.findUnique({ where: { id: productId }, select: { qtyOnHand: true } }),
        tx.stockMovement.aggregate({ where: { productId }, _sum: { quantity: true } }),
    ]);
    if (!product) throw new Error("That product is no longer there.");
    const now = sum._sum.quantity ?? new Prisma.Decimal(0);
    await tx.product.update({ where: { id: productId }, data: { qtyOnHand: now } });
    return { was: product.qtyOnHand.toNumber(), now: now.toNumber() };
}

export async function movementsFor(db: TenantDb, productId: string, take = 50) {
    return db.stockMovement.findMany({
        where: { productId },
        orderBy: [{ at: "desc" }, { createdAt: "desc" }],
        take,
        select: {
            id: true, at: true, kind: true, quantity: true, unitCost: true, note: true,
            document: { select: { id: true, type: true, number: true, jobNumber: true } },
            by: { select: { user: { select: { firstName: true } } } },
        },
    });
}
