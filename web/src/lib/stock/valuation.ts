import "server-only";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";

/**
 * What the stock on the shelves is worth.
 *
 * Valued at cost, never at retail. An owner asking "what is my stock worth"
 * usually means "how much money is sitting on those shelves", and the answer
 * an accountant will accept in a balance sheet is what was paid for it, not
 * what it might fetch. Both are shown — the retail column is what the same
 * stock is priced at — but the total that carries is the cost one.
 *
 * Cost is the product's current cost, which is the figure the workshop
 * maintains and reprices against. It is not a weighted average of what each
 * unit actually cost on the day it arrived; MOTION does not keep per-unit cost
 * layers, and pretending otherwise in a valuation would be worse than saying
 * plainly which cost this is.
 */

const num = (d: { toNumber(): number }) => d.toNumber();

export type ValuationRow = {
    itemCode: string;
    description: string;
    group: string;
    supplier: string;
    location: string;
    onHand: number;
    unitCost: number;
    value: number;
    retail: number;
    /** Below the minimum the workshop set, so it is worth reordering. */
    low: boolean;
};

export async function stockValuation(db: TenantDb): Promise<{
    rows: ValuationRow[];
    value: number;
    retail: number;
    lines: number;
    units: number;
    negative: number;
    noCost: number;
}> {
    const products = await db.product.findMany({
        // Labour and sublet have no shelf and cannot be counted, and neither
        // can anything flagged as a service. `dontUpdateQty` marks
        // the products a workshop deliberately does not track — bulk oil sold
        // by the litre, say — and a valuation that included them would be
        // reporting a quantity nobody maintains.
        where: { archivedAt: null, isService: false, dontUpdateQty: false, type: { notIn: ["LABOUR", "SUBLET"] } },
        orderBy: [{ itemCode: "asc" }],
        select: {
            itemCode: true, description: true, location: true, qtyOnHand: true, minQty: true,
            costExTax: true, retailPrice: true,
            group: { select: { name: true } },
            supplier: { select: { companyName: true } },
        },
    });

    const rows: ValuationRow[] = products
        .map((p) => {
            const onHand = num(p.qtyOnHand);
            const unitCost = num(p.costExTax);
            return {
                itemCode: p.itemCode,
                description: p.description,
                group: p.group?.name ?? "",
                supplier: p.supplier?.companyName ?? "",
                location: p.location ?? "",
                onHand,
                unitCost,
                value: round2(onHand * unitCost),
                retail: round2(onHand * num(p.retailPrice)),
                low: num(p.minQty) > 0 && onHand < num(p.minQty),
            };
        })
        // Nothing on the shelf and nothing owed to the shelf is not a line in a
        // valuation. A negative stays: it is a counting error worth seeing.
        .filter((r) => r.onHand !== 0);

    return {
        rows,
        value: round2(rows.reduce((t, r) => t + r.value, 0)),
        retail: round2(rows.reduce((t, r) => t + r.retail, 0)),
        lines: rows.length,
        units: round2(rows.reduce((t, r) => t + r.onHand, 0)),
        negative: rows.filter((r) => r.onHand < 0).length,
        noCost: rows.filter((r) => r.onHand > 0 && r.unitCost === 0).length,
    };
}
