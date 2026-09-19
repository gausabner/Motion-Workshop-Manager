import type { DocumentType, LineType, ProductType } from "@prisma/client";
import { calculateLine, round2, type LineInput } from "@/lib/documents/totals";

/**
 * What moves stock, which way, and what it earned.
 *
 * Pure, so the awkward parts — a credit note putting stock back, a service
 * item that has no stock to move, a discount eating a margin — are tested
 * without a database.
 */

/** Labour and sublets have nothing on a shelf; neither does an item the workshop has told us not to count. */
export function movesStock(product: { type: ProductType; isService: boolean; dontUpdateQty: boolean } | null): boolean {
    if (!product) return false;
    if (product.isService || product.dontUpdateQty) return false;
    return product.type !== "LABOUR" && product.type !== "SUBLET";
}

/**
 * Whether a document posts stock at all. The direction is already in the line:
 * a credit note is stored as the sale run backwards, with negative quantities,
 * so stock always moves by the opposite of what the line says — out on a sale,
 * and back in on a credit, without anyone flipping a sign twice.
 */
export function postsStock(type: DocumentType): boolean {
    return type === "INVOICE" || type === "CASH_SALE" || type === "CREDIT";
}

export type MarginLine = LineInput & { lineType: LineType };

export type Margin = { sales: number; cost: number; profit: number; percent: number | null };

/**
 * Money made on a set of lines, always excluding tax on both sides — a margin
 * worked out on tax-inclusive prices flatters itself by the VAT rate.
 *
 * `percent` is profit over sales, and null when there are no sales to divide
 * by: a nil sale has no margin, rather than a margin of zero.
 */
export function marginOf(lines: MarginLine[], pricesIncludeTax: boolean): Margin {
    let sales = 0;
    let cost = 0;
    for (const line of lines) {
        const totals = calculateLine(line, pricesIncludeTax);
        sales = round2(sales + totals.lineSubtotal);
        cost = round2(cost + totals.cost);
    }
    const profit = round2(sales - cost);
    return { sales, cost, profit, percent: sales === 0 ? null : round2((profit / sales) * 100) };
}

/** The same figures, split the way a workshop thinks about them. */
export function marginByLineType(lines: MarginLine[], pricesIncludeTax: boolean): { lineType: LineType; margin: Margin }[] {
    const groups = new Map<LineType, MarginLine[]>();
    for (const line of lines) groups.set(line.lineType, [...(groups.get(line.lineType) ?? []), line]);
    return [...groups].map(([lineType, group]) => ({ lineType, margin: marginOf(group, pricesIncludeTax) }));
}

/** What a line is worth on the shelf: a sale at zero cost is a warning sign, not a 100% margin to celebrate. */
export function missingCost(lines: MarginLine[]): number {
    return lines.filter((l) => Number(l.unitCost) === 0 && Number(l.unitPrice) !== 0 && l.lineType !== "LABOUR").length;
}
