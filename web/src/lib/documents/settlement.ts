import type { DocumentState, DocumentType } from "@prisma/client";
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

/** Money taken on a payment but not allocated to any document — the customer's unapplied credit. */
export function unappliedAmount(tendered: number[], allocated: number[]): number {
    return round2(Math.max(sum(tendered) - sum(allocated), 0));
}

/**
 * Why a payment cannot be posted yet, or null when it can.
 *
 * The benchmark insists allocations exactly equal tenders. We deliberately
 * relax that to "may not exceed": a payment taken on account, before the
 * invoice exists, is exactly how unapplied credit legitimately arises.
 */
export function paymentPostingError(tendered: number[], allocated: number[]): string | null {
    const tenderTotal = sum(tendered);
    const allocationTotal = sum(allocated);
    if (tenderTotal <= 0) return "Add at least one tender with an amount.";
    if (tendered.some((t) => Number(t) < 0) || allocated.some((a) => Number(a) < 0)) return "Amounts cannot be negative.";
    if (allocationTotal > tenderTotal) return `Allocated ${allocationTotal.toFixed(2)} is more than the ${tenderTotal.toFixed(2)} tendered.`;
    return null;
}
