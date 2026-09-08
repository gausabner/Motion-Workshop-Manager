/**
 * Document money math (PRD DOC-02). Pure functions over plain numbers — no
 * Prisma, no Decimal — so they can be unit-tested and reused on the client for
 * live totals while typing.
 *
 * Namibian workshops quote VAT-inclusive retail prices, so `pricesIncludeTax`
 * decides whether a line's unit price already contains VAT (back it out) or
 * not (add it on top). Every stored figure is rounded to 2 decimals at the
 * line level; totals are the sum of the rounded lines, which is what appears
 * on the printed invoice.
 */

export type LineInput = {
    quantity: number;
    unitPrice: number;
    unitCost?: number;
    vatRate: number;
    discountPercent?: number;
};

export type LineTotals = {
    /** Excluding VAT, after the line discount. */
    lineSubtotal: number;
    vatAmount: number;
    /** Including VAT. */
    lineTotal: number;
    cost: number;
};

export type DocumentTotalsInput = {
    lines: LineInput[];
    pricesIncludeTax: boolean;
    /** Whole-document discount. A percent wins over an amount when both are set. */
    discountPercent?: number | null;
    discountAmount?: number | null;
    freight?: number | null;
    /** VAT rate applied to freight; 0 leaves freight untaxed. */
    freightVatRate?: number;
};

export type DocumentTotals = {
    lines: LineTotals[];
    /** Sum of line subtotals before the header discount. */
    grossSubtotal: number;
    /** Header discount actually applied, excluding VAT. */
    discountApplied: number;
    /** Excluding VAT, after the header discount, including freight. */
    subtotal: number;
    vatTotal: number;
    total: number;
    totalCost: number;
    /** subtotal − totalCost. Negative means the job is being sold below cost. */
    grossProfit: number;
    grossMarginPercent: number;
};

export function round2(n: number): number {
    if (!Number.isFinite(n)) return 0;
    // The +Number.EPSILON nudge keeps 1.005 from rounding down through binary float error.
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calculateLine(line: LineInput, pricesIncludeTax: boolean): LineTotals {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    const vatRate = Number(line.vatRate) || 0;
    const discount = Math.min(Math.max(Number(line.discountPercent) || 0, 0), 100);

    const amount = qty * price * (1 - discount / 100);
    let lineSubtotal: number;
    let vatAmount: number;
    if (pricesIncludeTax) {
        lineSubtotal = round2(amount / (1 + vatRate / 100));
        vatAmount = round2(amount - lineSubtotal);
    } else {
        lineSubtotal = round2(amount);
        vatAmount = round2(lineSubtotal * (vatRate / 100));
    }
    return {
        lineSubtotal,
        vatAmount,
        lineTotal: round2(lineSubtotal + vatAmount),
        cost: round2(qty * (Number(line.unitCost) || 0)),
    };
}

export function calculateTotals(input: DocumentTotalsInput): DocumentTotals {
    const lines = input.lines.map((l) => calculateLine(l, input.pricesIncludeTax));
    const grossSubtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const grossVat = lines.reduce((s, l) => s + l.vatAmount, 0);

    // Header discount, excluding VAT. A percent takes precedence over an amount.
    let discountApplied = 0;
    if (input.discountPercent != null && input.discountPercent > 0) {
        discountApplied = round2(grossSubtotal * (Math.min(input.discountPercent, 100) / 100));
    } else if (input.discountAmount != null && input.discountAmount > 0) {
        discountApplied = round2(Math.min(input.discountAmount, grossSubtotal));
    }
    // VAT falls with the discount, in the same proportion.
    const factor = grossSubtotal > 0 ? (grossSubtotal - discountApplied) / grossSubtotal : 1;

    const freight = round2(Number(input.freight) || 0);
    const freightVat = round2(freight * ((input.freightVatRate ?? 0) / 100));

    const subtotal = round2(grossSubtotal - discountApplied + freight);
    const vatTotal = round2(grossVat * factor + freightVat);
    const total = round2(subtotal + vatTotal);
    const totalCost = round2(lines.reduce((s, l) => s + l.cost, 0));
    const grossProfit = round2(subtotal - totalCost);

    return {
        lines,
        grossSubtotal,
        discountApplied,
        subtotal,
        vatTotal,
        total,
        totalCost,
        grossProfit,
        grossMarginPercent: subtotal > 0 ? round2((grossProfit / subtotal) * 100) : 0,
    };
}

/** Amount still owed on a processed invoice. */
export function amountDue(total: number, amountPaid: number): number {
    return round2(Math.max(total - amountPaid, 0));
}
