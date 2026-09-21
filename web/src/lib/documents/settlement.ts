import type { DocumentState, DocumentType, PaymentDirection } from "@prisma/client";
import { round2 } from "@/lib/documents/totals";

/**
 * Settlement rules (R1c). Pure functions, so the state machine that decides
 * when an invoice is paid can be tested without a database.
 *
 * Paid and due are never stored on the document — they are derived from
 * allocations every time. The benchmark stores `balance_due` and we watched it
 * go stale on a settled supplier invoice; this module is the alternative.
 */

/** Document types that put money on an account and therefore settle. */
export const SETTLING_TYPES: ReadonlySet<DocumentType> = new Set<DocumentType>(["INVOICE", "CASH_SALE", "CREDIT"]);

function sum(values: number[]): number {
    return round2(values.reduce((s, v) => s + (Number(v) || 0), 0));
}

/**
 * The state a draft moves to when processed. A zero-value invoice (warranty
 * work, a goodwill job) has nothing to collect, so it closes immediately
 * instead of sitting in the Unpaid list forever.
 */
export function stateOnProcess(type: DocumentType, total: number): DocumentState {
    return SETTLING_TYPES.has(type) && round2(total) === 0 ? "CLOSED" : "PROCESSED";
}

/**
 * The state after a document's allocations change — a payment posted, or a
 * payment voided. Matches the benchmark: a part payment leaves it PROCESSED,
 * full settlement closes it, and voiding a payment re-opens it. Drafts, voided
 * documents and job-like documents never move.
 *
 * Absolute values let a credit note (negative total) settle the same way.
 */
export function stateAfterAllocation(state: DocumentState, type: DocumentType, total: number, allocated: number): DocumentState {
    if (state !== "PROCESSED" && state !== "CLOSED") return state;
    if (!SETTLING_TYPES.has(type)) return state;
    const outstanding = round2(Math.abs(total) - Math.abs(allocated));
    return outstanding <= 0 ? "CLOSED" : "PROCESSED";
}

/**
 * Money that moved with no document to account for it: unapplied credit on a
 * receipt, and credit drawn back out of the account on a refund. Signed, so
 * the two read as opposites of each other.
 */
export function unallocatedAmount(tendered: number[], allocated: number[]): number {
    return round2(sum(tendered) - sum(allocated));
}

/**
 * Trim a requested allocation to what the document can actually take: never
 * past its outstanding, and never against its sign. An invoice with N$400 left
 * cannot absorb N$600, and nothing negative can be pushed onto it.
 */
export function clampAllocation(outstanding: number, requested: number): number {
    const out = round2(outstanding);
    const want = round2(requested);
    if (out === 0 || want === 0) return 0;
    if (out > 0) return Math.min(Math.max(want, 0), out);
    return Math.max(Math.min(want, 0), out);
}

/**
 * Why a payment cannot be posted yet, or null when it can.
 *
 * Allocations are signed the way the document's own outstanding is signed:
 * positive against an invoice, negative against a credit note. Their sum is
 * therefore the money that actually has to change hands, which is what the
 * tenders must cover. Three consequences fall out of that:
 *
 *  - a receipt with no tenders at all is a pure credit application (+300 on
 *    the invoice, −300 off the credit note, nothing changes hands);
 *  - the benchmark insists allocations exactly equal tenders, and we
 *    deliberately relax that to "may not exceed" — money taken on account,
 *    before the invoice exists, is how unapplied credit legitimately arises;
 *  - a refund is the whole thing mirrored. Its tenders are negative, so every
 *    sum downstream nets correctly with no direction-aware arithmetic
 *    anywhere else, and the rule below is the same inequality with the sign
 *    turned around.
 */
export function paymentPostingError(tendered: number[], allocated: number[], direction: PaymentDirection = "RECEIPT"): string | null {
    const tenderTotal = sum(tendered);
    const allocationTotal = sum(allocated);

    if (direction === "REFUND") {
        if (tendered.some((t) => Number(t) > 0)) return "A refund pays money out, so its amounts cannot be positive.";
        if (tenderTotal === 0 && allocated.length === 0) return "Enter what is being paid out, or pick a credit note to refund.";
        if (allocationTotal > 0) return "A refund cannot be applied to an invoice. Take a receipt instead.";
        if (allocationTotal < tenderTotal) return `Drawing down ${Math.abs(allocationTotal).toFixed(2)} of credit is more than the ${Math.abs(tenderTotal).toFixed(2)} being paid out.`;
        return null;
    }

    if (tendered.some((t) => Number(t) < 0)) return "Tender amounts cannot be negative.";
    if (tenderTotal === 0 && allocated.length === 0) return "Add at least one tender with an amount, or allocate a credit note.";
    if (allocationTotal < 0) return "The allocations come to less than nothing. Paying a credit back out is a refund, not a receipt.";
    if (allocationTotal > tenderTotal) return `Allocated ${allocationTotal.toFixed(2)} is more than the ${tenderTotal.toFixed(2)} tendered.`;
    return null;
}
