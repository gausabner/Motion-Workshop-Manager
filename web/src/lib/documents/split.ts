import type { DocumentState, DocumentType } from "@prisma/client";
import { round2 } from "@/lib/documents/totals";

/**
 * Splitting one job between two payers, and redoing work that came back.
 *
 * The insurance case is the one that matters: the insurer pays everything
 * except the excess, and the customer pays the excess. Both invoices must add
 * back up to the job — a split that loses or invents money is worse than
 * typing two invoices by hand.
 */

export type SplitLine = { id: string; description: string; lineTotal: number };

/** Only a draft can be split: once an invoice is posted, its lines are its own. */
export function splitError(state: DocumentState, type: DocumentType, lineCount: number): string | null {
    if (state !== "DRAFT") return "Only a draft can be split. Raise a credit note if a posted invoice is wrong.";
    if (type === "CREDIT") return "A credit note cannot be split.";
    if (lineCount === 0) return "There is nothing on this document to split.";
    return null;
}

export type ExcessSplit = { toPayer: number; toOriginal: number };

/**
 * An excess split: the customer pays `excess`, the payer the rest. An excess
 * larger than the job means the customer simply pays the job — there is
 * nothing left for an insurer to pay, and no negative invoice is ever raised.
 */
export function splitByExcess(total: number, excess: number): ExcessSplit {
    const job = round2(total);
    const paid = Math.max(0, Math.min(round2(excess), job));
    return { toPayer: round2(job - paid), toOriginal: paid };
}

export function excessError(total: number, excess: number): string | null {
    if (!Number.isFinite(excess) || excess <= 0) return "Enter the excess the customer is paying.";
    if (round2(excess) > round2(total)) return `The excess of ${excess.toFixed(2)} is more than the job's ${total.toFixed(2)}.`;
    return null;
}

/** What the two documents come to, for showing before anything is created. */
export function splitPreview(lines: SplitLine[], moving: Set<string>): { moved: number; kept: number; movedCount: number } {
    let moved = 0;
    let kept = 0;
    for (const line of lines) {
        if (moving.has(line.id)) moved = round2(moved + line.lineTotal);
        else kept = round2(kept + line.lineTotal);
    }
    return { moved, kept, movedCount: moving.size };
}

export function linesSplitError(lines: SplitLine[], moving: Set<string>): string | null {
    if (moving.size === 0) return "Choose the lines the other payer is taking.";
    if (moving.size === lines.length) return "That would move everything. Change the customer on this document instead.";
    return null;
}

/** A job can only be redone once it has been done. */
export function reworkError(state: DocumentState, type: DocumentType): string | null {
    if (type !== "JOB_CARD" && type !== "INVOICE" && type !== "CASH_SALE") return "Only a job card or an invoice can be redone.";
    if (state === "DRAFT") return "This job has not been processed yet — change it rather than redoing it.";
    if (state === "VOID") return "That job was voided.";
    return null;
}
