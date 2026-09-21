import "server-only";
import type { Prisma, Tenant } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { movesStock } from "@/lib/stock/rules";
import { applyError, outcomes, summarise, type CountLine } from "@/lib/stock/stocktake";

/**
 * Stock takes against the database. Drawing up a sheet snapshots what the
 * ledger believes; applying posts the difference as ordinary STOCKTAKE
 * movements, so the correction is as auditable as the sale that caused it.
 */

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);

export type Scope = { location?: string; codeFrom?: string; codeTo?: string; groupId?: string; includeZero: boolean };

export async function startStockTake(tx: TenantTx, tenant: Tenant, membershipId: string, scope: Scope, blind: boolean, note?: string): Promise<{ id: string; lines: number }> {
    const where: Prisma.ProductWhereInput = {
        archivedAt: null,
        ...(scope.location ? { location: { contains: scope.location, mode: "insensitive" } } : {}),
        ...(scope.groupId ? { groupId: scope.groupId } : {}),
        ...(scope.codeFrom ? { itemCode: { gte: scope.codeFrom } } : {}),
        ...(scope.codeTo ? { itemCode: { lte: scope.codeTo } } : {}),
    };
    const products = await tx.product.findMany({
        where,
        orderBy: { itemCode: "asc" },
        select: { id: true, itemCode: true, type: true, isService: true, dontUpdateQty: true, qtyOnHand: true, costExTax: true },
    });
    // Only things that live on a shelf; and by default, only what the books think is there.
    const counting = products.filter((p) => movesStock(p) && (scope.includeZero || num(p.qtyOnHand) !== 0));
    if (counting.length === 0) throw new Error("Nothing to count in that range.");

    const number = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const take = await tx.stockTake.create({
        data: { tenantId: tenant.id, number, scope: scope as Prisma.InputJsonValue, blind, note: note ?? null, startedById: membershipId },
        select: { id: true },
    });
    for (const product of counting) {
        await tx.stockTakeLine.create({
            data: { tenantId: tenant.id, takeId: take.id, productId: product.id, expected: product.qtyOnHand, unitCost: product.costExTax },
        });
    }
    return { id: take.id, lines: counting.length };
}

/** Counts as they are typed. Null clears a count, which is not the same as counting zero. */
export async function saveCounts(tx: TenantTx, takeId: string, counts: { lineId: string; counted: number | null; note?: string | null }[]): Promise<void> {
    const take = await tx.stockTake.findUnique({ where: { id: takeId }, select: { state: true } });
    if (!take) throw new Error("That count is no longer there.");
    if (take.state !== "DRAFT") throw new Error("This count has already been applied.");
    for (const count of counts) {
        await tx.stockTakeLine.updateMany({
            where: { id: count.lineId, takeId },
            data: { counted: count.counted, note: count.note ?? null, countedAt: count.counted === null ? null : new Date() },
        });
    }
}

export type ApplyResult = { posted: number; movedDuringCount: number; value: number };

/**
 * Post the count. Each counted line is compared with what the ledger says at
 * this moment, not with the sheet, so trading during the count cannot write
 * off stock that was legitimately sold.
 */
export async function applyStockTake(tx: TenantTx, tenant: Tenant, membershipId: string, takeId: string): Promise<ApplyResult> {
    const take = await tx.stockTake.findUnique({
        where: { id: takeId },
        select: {
            id: true, state: true, number: true,
            lines: { select: { id: true, productId: true, expected: true, counted: true, unitCost: true, product: { select: { qtyOnHand: true } } } },
        },
    });
    if (!take) throw new Error("That count is no longer there.");
    const countedLines = take.lines.filter((l) => l.counted !== null);
    const problem = applyError(take.state, countedLines.length);
    if (problem) throw new Error(problem);

    const lines: CountLine[] = take.lines.map((l) => ({
        productId: l.productId,
        expected: num(l.expected),
        counted: l.counted === null ? null : num(l.counted),
        onHand: num(l.product.qtyOnHand),
        unitCost: num(l.unitCost),
    }));
    const results = outcomes(lines);

    let posted = 0;
    for (const result of results) {
        if (result.adjustment === 0) continue;
        await tx.stockMovement.create({
            data: {
                tenantId: tenant.id, productId: result.productId, kind: "STOCKTAKE", quantity: result.adjustment,
                unitCost: lines.find((l) => l.productId === result.productId)?.unitCost ?? 0,
                note: `Counted ${result.counted} on ${take.number}`, byId: membershipId,
            },
        });
        await tx.product.update({ where: { id: result.productId }, data: { qtyOnHand: { increment: result.adjustment } } });
        posted++;
    }

    await tx.stockTake.update({ where: { id: takeId }, data: { state: "APPLIED", appliedAt: new Date(), appliedById: membershipId } });
    const summary = summarise(lines);
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: null, entityType: "StockTake", entityId: takeId, action: "APPLIED", diff: { posted, ...summary } },
    });
    return { posted, movedDuringCount: results.filter((r) => r.movedDuringCount).length, value: summary.value };
}

export async function cancelStockTake(tx: TenantTx, takeId: string): Promise<void> {
    const take = await tx.stockTake.findUnique({ where: { id: takeId }, select: { state: true } });
    if (!take) return;
    if (take.state === "APPLIED") throw new Error("An applied count cannot be cancelled. Correct the stock instead.");
    await tx.stockTake.update({ where: { id: takeId }, data: { state: "CANCELLED", cancelledAt: new Date() } });
}

export async function listStockTakes(db: TenantDb, take = 25) {
    const rows = await db.stockTake.findMany({
        orderBy: { startedAt: "desc" },
        take,
        select: {
            id: true, number: true, state: true, blind: true, startedAt: true, appliedAt: true, scope: true,
            startedBy: { select: { user: { select: { firstName: true } } } },
            lines: { select: { counted: true } },
        },
    });
    return rows.map((r) => ({
        id: r.id, number: r.number, state: r.state, blind: r.blind, startedAt: r.startedAt, appliedAt: r.appliedAt,
        by: r.startedBy?.user.firstName ?? null,
        lines: r.lines.length,
        counted: r.lines.filter((l) => l.counted !== null).length,
    }));
}

export async function getStockTake(db: TenantDb, id: string) {
    const take = await db.stockTake.findUnique({
        where: { id },
        select: {
            id: true, number: true, state: true, blind: true, scope: true, note: true, startedAt: true, appliedAt: true,
            startedBy: { select: { user: { select: { firstName: true } } } },
            appliedBy: { select: { user: { select: { firstName: true } } } },
            lines: {
                orderBy: { product: { itemCode: "asc" } },
                select: {
                    id: true, expected: true, counted: true, unitCost: true, note: true, productId: true,
                    product: { select: { itemCode: true, description: true, location: true, qtyOnHand: true } },
                },
            },
        },
    });
    if (!take) return null;
    const lines = take.lines.map((l) => ({
        id: l.id, productId: l.productId, itemCode: l.product.itemCode, description: l.product.description, location: l.product.location,
        expected: num(l.expected), counted: l.counted === null ? null : num(l.counted), onHand: num(l.product.qtyOnHand),
        unitCost: num(l.unitCost), note: l.note,
    }));
    return { ...take, lines, summary: summarise(lines) };
}

export type StockTakeRecord = NonNullable<Awaited<ReturnType<typeof getStockTake>>>;
