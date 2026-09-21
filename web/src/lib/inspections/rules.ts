import type { InspectionState } from "@prisma/client";

/**
 * Inspection rules (R5). Pure, so what a customer's taps do is tested.
 *
 * The benchmark's design, kept: RAG is two flags (urgent = red, soon =
 * amber, neither = green), and approval belongs to each finding, not to the
 * inspection. What is ours: the inspection's state is derived from those
 * decisions rather than set by hand, and a finding already on the job card
 * can never be taken back by a later tap.
 */

export type Rag = "red" | "amber" | "green" | "unchecked";

export type ItemLike = {
    urgent: boolean;
    soon: boolean;
    checked: boolean;
    estimate: number | null;
    approvedAt: Date | string | null;
    declinedAt: Date | string | null;
    documentLineId?: string | null;
};

export function rag(item: Pick<ItemLike, "urgent" | "soon" | "checked">): Rag {
    if (item.urgent) return "red";
    if (item.soon) return "amber";
    return item.checked ? "green" : "unchecked";
}

/** Only red and amber findings are put to the customer. Green needs no answer. */
export function needsDecision(item: ItemLike): boolean {
    return item.urgent || item.soon;
}

export function decided(item: ItemLike): boolean {
    return !!item.approvedAt || !!item.declinedAt;
}

/**
 * Where the inspection stands once decisions change. Drafts and finalised
 * inspections are not moved by decisions; a requested one becomes approved
 * when every finding has an answer and at least one was a yes, refused when
 * every answer was no.
 */
export function stateAfterDecisions(state: InspectionState, items: ItemLike[]): InspectionState {
    if (state === "DRAFT" || state === "FINALISED") return state;
    const flagged = items.filter(needsDecision);
    if (flagged.length === 0 || flagged.some((i) => !decided(i))) return "REQUESTED";
    return flagged.some((i) => i.approvedAt) ? "APPROVED" : "REFUSED";
}

/** The two figures a customer looks at: what must be done, and what should be done soon. */
export function estimates(items: ItemLike[]): { urgent: number; soon: number; approved: number } {
    const round = (n: number) => Math.round(n * 100) / 100;
    let urgent = 0, soon = 0, approved = 0;
    for (const i of items) {
        const e = i.estimate ?? 0;
        if (i.urgent) urgent += e;
        else if (i.soon) soon += e;
        if (i.approvedAt) approved += e;
    }
    return { urgent: round(urgent), soon: round(soon), approved: round(approved) };
}

/**
 * Why a decision on this finding cannot be recorded, or null when it can.
 * Once it is on the job card, the answer is settled — changing it is a
 * conversation at the counter, not a tap.
 */
export function decisionError(state: InspectionState, item: ItemLike): string | null {
    if (state === "DRAFT") return "This inspection has not been sent for approval yet.";
    if (state === "FINALISED") return "This inspection is closed.";
    if (!needsDecision(item)) return "Only red and amber findings need an answer.";
    if (item.documentLineId) return "That work is already on the job card.";
    return null;
}

/** Findings that have been approved and are not on the job card yet. */
export function toConvert<T extends ItemLike>(items: T[]): T[] {
    return items.filter((i) => i.approvedAt && !i.documentLineId);
}
