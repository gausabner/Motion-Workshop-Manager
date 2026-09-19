import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";
import { movesStock } from "@/lib/stock/rules";

export type ProductListParams = { q?: string; type?: string; lowOnly?: boolean; archived?: boolean; page?: number; size?: number };

const num = (d: Prisma.Decimal | null) => (d ? d.toNumber() : 0);

export async function listProducts(db: TenantDb, p: ProductListParams) {
    const size = Math.min(Math.max(p.size ?? 25, 10), 100);
    const page = Math.max(p.page ?? 1, 1);
    const where: Prisma.ProductWhereInput = {
        archivedAt: p.archived ? { not: null } : null,
        ...(p.type ? { type: p.type as Prisma.EnumProductTypeFilter["equals"] } : {}),
        ...(p.q
            ? { OR: [
                { itemCode: { contains: p.q, mode: "insensitive" } },
                { description: { contains: p.q, mode: "insensitive" } },
                { brand: { contains: p.q, mode: "insensitive" } },
                { location: { contains: p.q, mode: "insensitive" } },
            ] }
            : {}),
    };
    const [rows, total] = await Promise.all([
        db.product.findMany({
            where,
            orderBy: [{ itemCode: "asc" }],
            skip: (page - 1) * size,
            take: size,
            select: {
                id: true, itemCode: true, description: true, type: true, isService: true, dontUpdateQty: true,
                qtyOnHand: true, minQty: true, location: true, costExTax: true, retailPrice: true,
                group: { select: { name: true } }, supplier: { select: { companyName: true } },
            },
        }),
        db.product.count({ where }),
    ]);
    const mapped = rows.map((r) => {
        const onHand = num(r.qtyOnHand);
        const cost = num(r.costExTax);
        return {
            id: r.id, itemCode: r.itemCode, description: r.description, type: r.type, isService: r.isService,
            // The same rule the ledger uses, so the list cannot claim to count something the ledger ignores.
            tracked: movesStock(r),
            onHand, minQty: num(r.minQty), location: r.location, cost, retail: num(r.retailPrice),
            value: round2(onHand * cost), group: r.group?.name ?? null, supplier: r.supplier?.companyName ?? null,
        };
    });
    return { rows: p.lowOnly ? mapped.filter((r) => r.tracked && r.onHand <= r.minQty) : mapped, total, page, size, pages: Math.max(1, Math.ceil(total / size)) };
}

export async function getProduct(db: TenantDb, id: string) {
    const p = await db.product.findUnique({
        where: { id },
        select: {
            id: true, itemCode: true, description: true, description2: true, type: true, isService: true, vatExempt: true, dontUpdateQty: true,
            brand: true, location: true, comment: true, jobCardComment: true, defaultLabourQty: true,
            qtyOnHand: true, minQty: true, maxQty: true, costExTax: true, costIncTax: true, retailPrice: true, price2: true, price3: true, price4: true,
            groupId: true, categoryId: true, supplierId: true, archivedAt: true,
        },
    });
    if (!p) return null;
    return {
        ...p,
        qtyOnHand: num(p.qtyOnHand), minQty: num(p.minQty), maxQty: num(p.maxQty),
        costExTax: num(p.costExTax), costIncTax: num(p.costIncTax),
        retailPrice: num(p.retailPrice), price2: num(p.price2), price3: num(p.price3), price4: num(p.price4),
        defaultLabourQty: p.defaultLabourQty ? p.defaultLabourQty.toNumber() : null,
    };
}

export type ProductRecord = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

/** The lists a product form picks from. */
export async function productOptions(db: TenantDb) {
    const [groups, categories, suppliers] = await Promise.all([
        db.productGroup.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
        db.productCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
        db.supplier.findMany({ where: { archivedAt: null }, orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    ]);
    return { groups, categories, suppliers };
}

/** What this product has sold, and what it made, over a window. */
export async function productSales(db: TenantDb, productId: string, from: Date) {
    const lines = await db.documentLine.findMany({
        where: { productId, document: { state: { in: ["PROCESSED", "CLOSED"] }, type: { in: ["INVOICE", "CASH_SALE", "CREDIT"] }, postDate: { gte: from } } },
        select: { quantity: true, unitPrice: true, unitCost: true, vatRate: true, discountPercent: true, lineType: true, document: { select: { pricesIncludeTax: true } } },
    });
    return lines.map((l) => ({
        lineType: l.lineType,
        quantity: num(l.quantity),
        unitPrice: num(l.unitPrice), unitCost: num(l.unitCost), vatRate: num(l.vatRate), discountPercent: num(l.discountPercent),
        pricesIncludeTax: l.document.pricesIncludeTax,
    }));
}
