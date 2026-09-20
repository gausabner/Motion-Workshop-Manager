import type { SupplierInvoiceState } from "@prisma/client";
import { round2 } from "@/lib/documents/totals";

/**
 * What is still owed to suppliers, always derived from the allocations.
 *
 * The benchmark stores a balance on the supplier invoice and lets it go stale:
 * its own `balance_due` still reads the full amount on an invoice its status
 * says is settled. Nothing here is stored, so nothing can drift.
 */

export function supplierOutstanding(total: number, allocated: number): number {
    return round2(round2(total) - round2(allocated));
}

/** An invoice closes when nothing is left on it, and re-opens if a payment is reversed. */
export function stateAfterSupplierAllocation(state: SupplierInvoiceState, total: number, allocated: number): SupplierInvoiceState {
    if (state !== "PROCESSED" && state !== "CLOSED") return state;
    return supplierOutstanding(total, allocated) <= 0 ? "CLOSED" : "PROCESSED";
}

/** How much of `requested` may go against an invoice with `outstanding` left. Never more, never negative. */
export function clampSupplierAllocation(outstanding: number, requested: number): number {
    const left = round2(outstanding);
    const want = round2(requested);
    if (left <= 0 || want <= 0) return 0;
    return Math.min(want, left);
}

/**
 * Why a supplier payment cannot be posted yet, or null when it can. Paying
 * out more than the invoices come to is the one thing that cannot be squared
 * later: there is no supplier account to leave it sitting on.
 */
export function supplierPaymentError(amount: number, allocations: number[]): string | null {
    const paid = round2(amount);
    const applied = round2(allocations.reduce((total, a) => total + round2(a), 0));
    if (paid <= 0) return "Enter what is being paid.";
    if (allocations.some((a) => round2(a) < 0)) return "An amount against an invoice cannot be negative.";
    if (applied === 0) return "Choose at least one invoice to pay.";
    if (applied > paid) return `The invoices come to ${applied.toFixed(2)}, which is more than the ${paid.toFixed(2)} being paid.`;
    if (applied < paid) return `${round2(paid - applied).toFixed(2)} of this payment is not against any invoice. Apply it, or reduce the amount.`;
    return null;
}

/** Spread a payment over the oldest invoices first — how a workshop pays a statement. */
export function spreadOldestFirst(amount: number, invoices: { id: string; outstanding: number }[]): Map<string, number> {
    let left = round2(amount);
    const out = new Map<string, number>();
    for (const invoice of invoices) {
        if (left <= 0) break;
        const take = clampSupplierAllocation(invoice.outstanding, left);
        if (take > 0) {
            out.set(invoice.id, take);
            left = round2(left - take);
        }
    }
    return out;
}
