import "server-only";
import { Prisma, type MatrixBasis, type PriceRounding } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { priceFrom, type Band, type Matrix } from "@/lib/products/matrix";

/**
 * Price matrices against the database. Applying one never touches cost — cost
 * is a fact — only what the workshop asks for the thing.
 */

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);

export async function listMatrices(db: TenantDb) {
    const rows = await db.priceMatrix.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        select: { id: true, name: true, basis: true, rounding: true, active: true, bands: { select: { id: true } }, _count: { select: { products: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, basis: r.basis, rounding: r.rounding, active: r.active, bands: r.bands.length, products: r._count.products }));
}

export async function getMatrix(db: TenantDb, id: string) {
    const matrix = await db.priceMatrix.findUnique({
        where: { id },
        select: {
            id: true, name: true, basis: true, rounding: true, active: true, note: true,
            bands: { orderBy: { costFrom: "asc" }, select: { id: true, costFrom: true, costTo: true, percent: true } },
            _count: { select: { products: true } },
        },
    });
    if (!matrix) return null;
    return {
        ...matrix,
        products: matrix._count.products,
        bands: matrix.bands.map((b) => ({ id: b.id, costFrom: num(b.costFrom), costTo: b.costTo === null ? null : num(b.costTo), percent: num(b.percent) })),
    };
}

export type MatrixRecord = NonNullable<Awaited<ReturnType<typeof getMatrix>>>;

export type MatrixInput = { name: string; basis: MatrixBasis; rounding: PriceRounding; active: boolean; note?: string | null; bands: Band[] };

export async function saveMatrix(tx: TenantTx, tenantId: string, id: string | null, input: MatrixInput): Promise<string> {
    const clash = await tx.priceMatrix.findFirst({ where: { name: { equals: input.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) throw new Error(`There is already a matrix called "${input.name}".`);

    let matrixId = id;
    if (matrixId) {
        const existing = await tx.priceMatrix.findUnique({ where: { id: matrixId }, select: { id: true } });
        if (!existing) throw new Error("That matrix is no longer there.");
        await tx.priceMatrix.update({ where: { id: matrixId }, data: { name: input.name, basis: input.basis, rounding: input.rounding, active: input.active, note: input.note ?? null } });
    } else {
        const created = await tx.priceMatrix.create({
            data: { tenantId, name: input.name, basis: input.basis, rounding: input.rounding, active: input.active, note: input.note ?? null },
            select: { id: true },
        });
        matrixId = created.id;
    }
    await tx.priceMatrixBand.deleteMany({ where: { matrixId } });
    for (const band of input.bands) {
        await tx.priceMatrixBand.create({ data: { tenantId, matrixId, costFrom: band.costFrom, costTo: band.costTo, percent: band.percent } });
    }
    return matrixId;
}

export async function deleteMatrix(tx: TenantTx, id: string): Promise<void> {
    const used = await tx.product.count({ where: { priceMatrixId: id } });
    if (used > 0) throw new Error(`${used} product${used === 1 ? " is" : "s are"} priced by this matrix. Move them off it first, or switch it off.`);
    await tx.priceMatrix.delete({ where: { id } });
}

/** The matrix as the pure pricing rules want it. */
export async function matrixFor(tx: TenantTx, matrixId: string): Promise<Matrix | null> {
    const matrix = await tx.priceMatrix.findUnique({
        where: { id: matrixId },
        select: { basis: true, rounding: true, active: true, bands: { select: { costFrom: true, costTo: true, percent: true } } },
    });
    if (!matrix || !matrix.active) return null;
    return {
        basis: matrix.basis,
        rounding: matrix.rounding,
        bands: matrix.bands.map((b) => ({ costFrom: num(b.costFrom), costTo: b.costTo === null ? null : num(b.costTo), percent: num(b.percent) })),
    };
}

/**
 * Bring one product's price into line with its matrix. Returns null when it is
 * on no matrix, or the matrix has nothing to say about that cost — in which
 * case the price it already has is left alone.
 */
export async function applyMatrixToProduct(tx: TenantTx, productId: string, cost?: number): Promise<{ from: number; to: number } | null> {
    const product = await tx.product.findUnique({ where: { id: productId }, select: { id: true, priceMatrixId: true, costExTax: true, retailPrice: true } });
    if (!product?.priceMatrixId) return null;
    const matrix = await matrixFor(tx, product.priceMatrixId);
    if (!matrix) return null;
    const price = priceFrom(cost ?? num(product.costExTax), matrix);
    if (price === null) return null;
    const from = num(product.retailPrice);
    if (from === price) return null;
    await tx.product.update({ where: { id: productId }, data: { retailPrice: price } });
    return { from, to: price };
}

export type RepriceRow = { id: string; itemCode: string; description: string; cost: number; from: number; to: number };

/** What repricing a whole matrix would do, before anyone commits to it. */
export async function previewReprice(db: TenantDb, matrixId: string): Promise<{ changes: RepriceRow[]; unchanged: number; unpriceable: number }> {
    const matrix = await matrixFor(db as unknown as TenantTx, matrixId);
    const products = await db.product.findMany({
        where: { priceMatrixId: matrixId, archivedAt: null },
        orderBy: { itemCode: "asc" },
        select: { id: true, itemCode: true, description: true, costExTax: true, retailPrice: true },
    });
    if (!matrix) return { changes: [], unchanged: 0, unpriceable: products.length };
    const changes: RepriceRow[] = [];
    let unchanged = 0;
    let unpriceable = 0;
    for (const product of products) {
        const cost = num(product.costExTax);
        const price = priceFrom(cost, matrix);
        if (price === null) unpriceable++;
        else if (price === num(product.retailPrice)) unchanged++;
        else changes.push({ id: product.id, itemCode: product.itemCode, description: product.description, cost, from: num(product.retailPrice), to: price });
    }
    return { changes, unchanged, unpriceable };
}

export async function repriceMatrix(tx: TenantTx, matrixId: string): Promise<number> {
    const products = await tx.product.findMany({ where: { priceMatrixId: matrixId, archivedAt: null }, select: { id: true } });
    let changed = 0;
    for (const product of products) {
        const result = await applyMatrixToProduct(tx, product.id);
        if (result) changed++;
    }
    return changed;
}
