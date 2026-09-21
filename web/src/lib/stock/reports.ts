import "server-only";
import type { LineType, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";
import { marginOf, type Margin } from "@/lib/stock/rules";

/**
 * What the workshop made, and on what. Every figure comes from the document
 * lines as they were posted — each on its own document's tax basis, since a
 * workshop can change whether it quotes tax-inclusive between one and the next.
 */

const SALE_TYPES = ["INVOICE", "CASH_SALE", "CREDIT"] as const;
const num = (d: { toNumber(): number }) => d.toNumber();

export type MarginRow = { key: string; label: string; sub: string | null; quantity: number; margin: Margin };

export async function marginReport(db: TenantDb, _tenant: Tenant, from: Date, to: Date) {
    const lines = await db.documentLine.findMany({
        // "Internal job — excluded from sales reporting" has always been on the document; this is where it means something.
        where: { document: { state: { in: ["PROCESSED", "CLOSED"] }, type: { in: [...SALE_TYPES] }, postDate: { gte: from, lte: to }, isInternal: false } },
        select: {
            quantity: true, unitPrice: true, unitCost: true, vatRate: true, discountPercent: true, lineType: true, description: true,
            product: { select: { id: true, itemCode: true, description: true } },
            document: {
                select: {
                    id: true, type: true, number: true, jobNumber: true, postDate: true, pricesIncludeTax: true,
                    customer: { select: { id: true, firstName: true, lastName: true } },
                    vehicle: { select: { plate: true } },
                },
            },
        },
    });

    const add = (into: Map<string, MarginRow>, key: string, label: string, sub: string | null, quantity: number, margin: Margin) => {
        const row = into.get(key) ?? { key, label, sub, quantity: 0, margin: { sales: 0, cost: 0, profit: 0, percent: null } };
        row.quantity = round2(row.quantity + quantity);
        row.margin = {
            sales: round2(row.margin.sales + margin.sales),
            cost: round2(row.margin.cost + margin.cost),
            profit: round2(row.margin.profit + margin.profit),
            percent: null,
        };
        into.set(key, row);
    };

    const byType = new Map<string, MarginRow>();
    const byProduct = new Map<string, MarginRow>();
    const byDocument = new Map<string, MarginRow>();
    let sales = 0;
    let cost = 0;
    let missingCost = 0;

    for (const line of lines) {
        // A credit note is already stored as the sale run backwards, with negative
        // quantities, so it takes itself off both sides without any flipping here.
        const quantity = num(line.quantity);
        const one = marginOf(
            [{ lineType: line.lineType, quantity, unitPrice: num(line.unitPrice), unitCost: num(line.unitCost), vatRate: num(line.vatRate), discountPercent: num(line.discountPercent) }],
            line.document.pricesIncludeTax,
        );
        sales = round2(sales + one.sales);
        cost = round2(cost + one.cost);
        if (num(line.unitCost) === 0 && num(line.unitPrice) !== 0 && line.lineType !== "LABOUR") missingCost++;

        add(byType, line.lineType, LINE_TYPE_LABELS[line.lineType] ?? line.lineType, null, quantity, one);
        const productKey = line.product?.id ?? `free:${line.description}`;
        add(byProduct, productKey, line.product?.itemCode ?? line.description, line.product?.description ?? "Typed in, not a product", quantity, one);
        const doc = line.document;
        add(
            byDocument, doc.id, doc.number ?? doc.jobNumber ?? "draft",
            [doc.customer ? `${doc.customer.firstName} ${doc.customer.lastName}`.trim() : "Cash sale", doc.vehicle?.plate].filter(Boolean).join(" · "),
            quantity, one,
        );
    }

    const withPercent = (rows: MarginRow[]) =>
        rows.map((r) => ({ ...r, margin: { ...r.margin, percent: r.margin.sales === 0 ? null : round2((r.margin.profit / r.margin.sales) * 100) } }));
    const byProfit = (a: MarginRow, b: MarginRow) => b.margin.profit - a.margin.profit;

    return {
        totals: { sales, cost, profit: round2(sales - cost), percent: sales === 0 ? null : round2(((sales - cost) / sales) * 100) },
        missingCost,
        byType: withPercent([...byType.values()]).sort(byProfit),
        topProducts: withPercent([...byProduct.values()]).sort(byProfit).slice(0, 15),
        worstProducts: withPercent([...byProduct.values()]).filter((r) => r.margin.profit < 0 || (r.margin.percent !== null && r.margin.percent < 10)).sort((a, b) => a.margin.profit - b.margin.profit).slice(0, 10),
        jobs: withPercent([...byDocument.values()]).sort(byProfit),
    };
}

export const LINE_TYPE_LABELS: Record<LineType, string> = {
    STOCK: "Parts",
    LABOUR: "Labour",
    SUBLET: "Sublet",
    CONSUMABLE: "Consumables",
    ACCESSORY: "Accessories",
    TYRE: "Tyres",
    FREIGHT: "Freight",
};
