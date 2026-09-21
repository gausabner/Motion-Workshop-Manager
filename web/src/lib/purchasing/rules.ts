import type { PurchaseOrderState, SupplierInvoiceState } from "@prisma/client";
import { calculateLine, round2 } from "@/lib/documents/totals";

/**
 * Buying, as arithmetic. Pure, so partial receipt — the awkward part, where
 * one ordered line arrives across several supplier invoices — is tested
 * without a database.
 */

export type CostLine = { quantity: number; unitCost: number; taxExempt?: boolean };
export type Totals = { subtotal: number; taxTotal: number; total: number };

/**
 * A supplier's document, on its own tax basis: suppliers quote differently
 * from one another, so the rate and whether it is included live on the
 * document rather than on the workshop.
 */
export function costTotals(lines: CostLine[], opts: { taxRate: number; pricesIncludeTax: boolean; freight?: number }): Totals {
    let subtotal = 0;
    let taxTotal = 0;
    for (const line of lines) {
        const totals = calculateLine(
            { quantity: line.quantity, unitPrice: line.unitCost, vatRate: line.taxExempt ? 0 : opts.taxRate, discountPercent: 0 },
            opts.pricesIncludeTax,
        );
        subtotal = round2(subtotal + totals.lineSubtotal);
        taxTotal = round2(taxTotal + totals.vatAmount);
    }
    // Freight is quoted before tax and taxed at the document's rate.
    const freight = round2(opts.freight ?? 0);
    const freightTax = round2(freight * (opts.taxRate / 100));
    return { subtotal: round2(subtotal + freight), taxTotal: round2(taxTotal + freightTax), total: round2(subtotal + freight + taxTotal + freightTax) };
}

export type OrderLineReceipt = { id: string; quantity: number; received: number };

/** How much of one ordered line is still to come. Over-delivery is not negative outstanding; it is nothing left to come. */
export function outstanding(line: OrderLineReceipt): number {
    return round2(Math.max(0, line.quantity - line.received));
}

export type ReceiptState = "none" | "part" | "full" | "over";

export function receiptState(lines: OrderLineReceipt[]): ReceiptState {
    if (lines.length === 0) return "none";
    const ordered = round2(lines.reduce((sum, l) => sum + l.quantity, 0));
    const received = round2(lines.reduce((sum, l) => sum + l.received, 0));
    if (received === 0) return "none";
    if (received > ordered) return "over";
    return received === ordered ? "full" : "part";
}

export const RECEIPT_LABELS: Record<ReceiptState, string> = {
    none: "Nothing received yet",
    part: "Part received",
    full: "All received",
    over: "More received than ordered",
};

/** A suggestion can be edited freely; an order that has gone to the supplier keeps its shape once goods start arriving. */
export function canEditOrder(state: PurchaseOrderState, anyReceived: boolean): boolean {
    if (state === "CANCELLED" || state === "RECEIVED") return false;
    return state === "SUGGESTED" || !anyReceived;
}

export function orderStateAfterReceipt(state: PurchaseOrderState, lines: OrderLineReceipt[]): PurchaseOrderState {
    if (state === "CANCELLED") return state;
    const received = receiptState(lines);
    return received === "full" || received === "over" ? "RECEIVED" : state === "SUGGESTED" ? "ORDERED" : state;
}

/** What a supplier invoice may do next. */
export function invoiceEditable(state: SupplierInvoiceState): boolean {
    return state === "DRAFT";
}

export function processInvoiceError(state: SupplierInvoiceState, lineCount: number, supplierNumber: string): string | null {
    if (state !== "DRAFT") return "Only a draft supplier invoice can be processed.";
    if (lineCount === 0) return "Add at least one line before processing.";
    if (!supplierNumber.trim()) return "Enter the supplier's invoice number.";
    return null;
}

/**
 * What a receipt is worth per unit, for putting on the shelf: the line's own
 * cost, always excluding tax, whatever basis the supplier quoted on.
 */
export function unitCostExTax(unitCost: number, taxRate: number, pricesIncludeTax: boolean, taxExempt = false): number {
    if (!pricesIncludeTax || taxExempt) return round2(unitCost);
    return round2(unitCost / (1 + taxRate / 100));
}

/** A suggested sell price from a new cost, keeping the margin the product sells at today. */
export function keepMarginPrice(newCostExTax: number, oldCostExTax: number, currentPrice: number): number | null {
    if (newCostExTax <= 0 || currentPrice <= 0) return null;
    if (oldCostExTax <= 0) return null;
    const margin = (currentPrice - oldCostExTax) / currentPrice;
    if (margin <= 0 || margin >= 1) return null;
    return round2(newCostExTax / (1 - margin));
}
