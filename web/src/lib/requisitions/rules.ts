import type { AuthorityKind, Designation, RequisitionKind, RequisitionState, RequisitionStep } from "@prisma/client";
import { round2 } from "@/lib/documents/totals";

/**
 * The rules of a requisition, as pure functions.
 *
 * Benchmarked on a council's paper "Requisition for Supplies" and the owner's
 * job flow brief, both of 19 November 2026 (`docs/requisitions-plan.md`,
 * `docs/fleet-job-flow-plan.md`):
 *
 * - The workshop asks. Its foreman signs, then the divisional head of the
 *   division that runs it, then — at or above the council's own value limit —
 *   one more approver.
 * - A purchase requisition carries the quotations the council's rule asks for
 *   at its value, and the approvers approve the chosen one.
 * - The fleet coordinator of the division that pays is told, and may approve
 *   against the vote or witness it; that never holds anything up.
 * - Once everything is issued or received, the foreman, the paying division's
 *   fleet coordinator and the divisional head finalise it. Whoever fitted it
 *   may sign too.
 *
 * Who may sign is an appointment, not a role, so these functions are handed
 * the appointments, the organisation and the signatures already made, and
 * decide from those alone — the screen, the action and the tests reach the
 * same answer.
 */

export type ApprovalStep = "FOREMAN" | "DIVISIONAL_HEAD" | "OVER_LIMIT";
export type FinalStep = "FINAL_FOREMAN" | "FINAL_FLEET_COORDINATOR" | "FINAL_DIVISIONAL_HEAD" | "FINAL_FITTER";

/** The finalising signatures that are always needed. The fitter's is welcome, not required. */
export const FINAL_REQUIRED: FinalStep[] = ["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD"];

/** Who fitted it: any of these may sign the fitter's box. */
export const FITTER_DESIGNATIONS: Designation[] = ["MECHANIC", "ARTISAN", "INTERN"];

export const STEP_LABEL: Record<RequisitionStep, string> = {
    REQUESTED: "Requisitioned by",
    FOREMAN: "Foreman",
    DIVISIONAL_HEAD: "Divisional Head",
    OVER_LIMIT: "Over the value limit",
    PAYER: "Fleet Coordinator, paying division",
    FINAL_FOREMAN: "Foreman",
    FINAL_FLEET_COORDINATOR: "Fleet Coordinator",
    FINAL_DIVISIONAL_HEAD: "Divisional Head",
    FINAL_FITTER: "Fitted by",
};

const AWAITING: Record<ApprovalStep, RequisitionState> = {
    FOREMAN: "AWAITING_FOREMAN",
    DIVISIONAL_HEAD: "AWAITING_HEAD",
    OVER_LIMIT: "AWAITING_OVER_LIMIT",
};

// ───────────────────────── who holds each box ─────────────────────────

export type Unit = { id: string; parentId: string | null };
export type Authority = { kind: AuthorityKind; workshopId: string | null; orgUnitId: string | null; membershipId: string; deputy: boolean };
export type Candidate = { membershipId: string; deputy: boolean };

/** A unit and those above it, nearest first. The tree is one or two levels; the bound only guards against a loop. */
export function lineage(unitId: string | null, units: Unit[]): string[] {
    const byId = new Map(units.map((u) => [u.id, u]));
    const chain: string[] = [];
    for (let id = unitId; id && chain.length < 10 && !chain.includes(id); id = byId.get(id)?.parentId ?? null) chain.push(id);
    return chain;
}

/**
 * Who holds `kind` for a scope. A division head or fleet coordinator appointed
 * to a unit holds it for everything under it, and the nearest appointment
 * wins: a department with its own head is not signed for by its division's.
 */
export function holders(
    kind: AuthorityKind,
    scope: { workshopId?: string | null; orgUnitId?: string | null },
    authorities: Authority[],
    units: Unit[],
): Candidate[] {
    const pick = (a: Authority): Candidate => ({ membershipId: a.membershipId, deputy: a.deputy });
    if (kind === "FOREMAN") return authorities.filter((a) => a.kind === kind && a.workshopId === (scope.workshopId ?? null)).map(pick);
    if (kind === "OVER_LIMIT") return authorities.filter((a) => a.kind === kind).map(pick);
    for (const unit of lineage(scope.orgUnitId ?? null, units)) {
        const found = authorities.filter((a) => a.kind === kind && a.orgUnitId === unit);
        if (found.length) return found.map(pick);
    }
    return [];
}

/** Where a requisition sits: the workshop asking, the unit that runs it, and the unit that pays. */
export type Scope = { workshopId: string | null; workshopUnitId: string | null; payingUnitId: string | null };

/**
 * The division that pays: the vote's unit when it is charged to a vote, and
 * otherwise the workshop's own. (With the cost-centre add-on a job is charged
 * to its vehicle's vote, and so to that vote's unit.)
 */
export function payingUnit(input: { voteUnitId: string | null; workshopUnitId: string | null }): string | null {
    return input.voteUnitId ?? input.workshopUnitId;
}

const BOX: Record<Exclude<RequisitionStep, "REQUESTED" | "FINAL_FITTER">, { kind: AuthorityKind; scope: "workshop" | "workshopUnit" | "payingUnit" | "council" }> = {
    FOREMAN: { kind: "FOREMAN", scope: "workshop" },
    DIVISIONAL_HEAD: { kind: "DIVISION_HEAD", scope: "workshopUnit" },
    OVER_LIMIT: { kind: "OVER_LIMIT", scope: "council" },
    PAYER: { kind: "FLEET_COORDINATOR", scope: "payingUnit" },
    FINAL_FOREMAN: { kind: "FOREMAN", scope: "workshop" },
    FINAL_FLEET_COORDINATOR: { kind: "FLEET_COORDINATOR", scope: "payingUnit" },
    FINAL_DIVISIONAL_HEAD: { kind: "DIVISION_HEAD", scope: "workshopUnit" },
};

/** Who may sign a box on this requisition. The fitter's box goes by designation, not appointment, and is not answered here. */
export function candidatesFor(step: Exclude<RequisitionStep, "REQUESTED" | "FINAL_FITTER">, scope: Scope, authorities: Authority[], units: Unit[]): Candidate[] {
    const box = BOX[step];
    const where =
        box.scope === "workshop" ? { workshopId: scope.workshopId }
        : box.scope === "workshopUnit" ? { orgUnitId: scope.workshopUnitId }
        : box.scope === "payingUnit" ? { orgUnitId: scope.payingUnitId }
        : {};
    return holders(box.kind, where, authorities, units);
}

// ───────────────────────── approval ─────────────────────────

/**
 * The approvals a requisition of this value needs, in the order they are
 * signed. Read against the limit as it stands: a council that lowers its
 * limit wants the requisitions still waiting to meet the new one.
 */
export function stepsFor(value: number, overLimitAt: number | null): ApprovalStep[] {
    const steps: ApprovalStep[] = ["FOREMAN", "DIVISIONAL_HEAD"];
    if (overLimitAt !== null && round2(value) >= round2(overLimitAt)) steps.push("OVER_LIMIT");
    return steps;
}

/** The approval a requisition is waiting on, or null when it is waiting on nobody's approval. */
export function stepOf(state: RequisitionState): ApprovalStep | null {
    for (const [step, s] of Object.entries(AWAITING) as [ApprovalStep, RequisitionState][]) if (s === state) return step;
    return null;
}

export function awaiting(step: ApprovalStep): RequisitionState {
    return AWAITING[step];
}

/** Lines, quotations and the charge change only while it is a draft: an approval covers what was approved. */
export function editable(state: RequisitionState): boolean {
    return state === "DRAFT";
}

/** The value of the lines excluding VAT, to the cent — the form's "Value". */
export function requisitionValue(lines: { quantity: number; unitCost: number }[]): number {
    return round2(lines.reduce((sum, l) => sum + round2(l.quantity * l.unitCost), 0));
}

/** What is approved: a stores requisition's lines at their rates, a purchase requisition's chosen quotation. */
export function approvalValue(kind: RequisitionKind, linesValue: number, chosenAmount: number | null): number {
    return kind === "PURCHASE" && chosenAmount !== null ? round2(chosenAmount) : round2(linesValue);
}

/**
 * Who may sign an approval now. Nobody signs their own request, and nobody
 * signs two approvals of one round: the foreman and the divisional head are
 * two checks only while they are two people. A deputy signs in the
 * principal's place, and the signature says so.
 */
export function eligible(candidates: Candidate[], input: { requesterId: string; signedThisRound: string[] }): Candidate[] {
    const signed = new Set(input.signedThisRound);
    return candidates.filter((c) => c.membershipId !== input.requesterId && !signed.has(c.membershipId));
}

/**
 * A foreman asking for their own workshop has nobody to sign the foreman step
 * unless another foreman, or a deputy, is appointed there. Then the step is
 * recorded as raised by the foreman and the divisional head signs next —
 * written down, never skipped in silence.
 */
export function foremanStepRaisedByForeman(foremen: Candidate[], requesterId: string): boolean {
    return foremen.some((c) => c.membershipId === requesterId) && foremen.every((c) => c.membershipId === requesterId);
}

/**
 * Why a draft cannot be submitted yet, in words for the requester, or null.
 * Checked on the screen and again in the action.
 */
export function submitError(input: {
    state: RequisitionState;
    workshopId: string | null;
    /** `productId` null is an item typed in by hand; `unitCost` is its estimate. Both are optional for callers that only check the basics. */
    lines: { description: string; quantity: number; productId?: string | null; unitCost?: number }[];
    chargeDocumentId: string | null;
    chargeVoteId: string | null;
}): string | null {
    if (input.state !== "DRAFT") return "This requisition has already been submitted.";
    if (!input.workshopId) return "Choose the workshop asking for these.";
    if (input.lines.length === 0) return "Add at least one line.";
    if (input.lines.some((l) => !l.description.trim())) return "Every line needs a description.";
    if (input.lines.some((l) => !(l.quantity > 0))) return "Every line needs a quantity of more than zero.";
    // Its value decides who must approve it, so an item without a price would slip under the council's limit.
    const unpriced = input.lines.find((l) => l.productId === null && l.unitCost !== undefined && !(l.unitCost > 0));
    if (unpriced) return `Give an estimated rate for “${unpriced.description}”. It is not a stock item, so the approvers need to see what it will cost.`;
    if (input.chargeDocumentId && input.chargeVoteId) return "Charge it to a job card or to a vote, not both.";
    if (!input.chargeDocumentId && !input.chargeVoteId) return "Charge it to a job card or to a vote.";
    return null;
}

/**
 * Whether every approval this requisition needs has somebody able to sign it.
 * Without this a requisition could be submitted into a queue nobody reads;
 * the requester is told now, and told who can fix it.
 */
export function unsignableStep(steps: ApprovalStep[], candidates: Record<ApprovalStep, Candidate[]>, requesterId: string): string | null {
    for (const step of steps) {
        if (step === "FOREMAN" && foremanStepRaisedByForeman(candidates.FOREMAN, requesterId)) continue;
        if (eligible(candidates[step], { requesterId, signedThisRound: [] }).length === 0) {
            const who =
                step === "FOREMAN" ? "the foreman step for this workshop"
                : step === "DIVISIONAL_HEAD" ? "the divisional head step for this workshop's division"
                : "the value limit";
            return `Nobody is appointed to sign ${who}. An owner or admin appoints them in Settings.`;
        }
    }
    return null;
}

export type Decision = "APPROVED" | "RETURNED" | "REJECTED";

/** Where a requisition goes after `step` is decided. If the limit moved and the step is no longer needed, this approval is the last. */
export function stateAfter(decision: Decision, step: ApprovalStep, steps: ApprovalStep[]): RequisitionState {
    if (decision === "RETURNED") return "DRAFT";
    if (decision === "REJECTED") return "REJECTED";
    const at = steps.indexOf(step);
    if (at === -1) return "APPROVED";
    const next = steps[at + 1];
    return next ? AWAITING[next] : "APPROVED";
}

/** Returning and rejecting each need a reason the requester can act on; approving does not. */
export function decisionError(decision: Decision, comment: string | null | undefined): string | null {
    if (decision === "APPROVED") return null;
    if (!comment?.trim()) return decision === "RETURNED" ? "Say what needs to change." : "Give the reason for rejecting it.";
    return null;
}

/**
 * Whether an order may go ahead on the value that was approved. Suppliers'
 * prices move, so a small difference is allowed; beyond the council's
 * tolerance the requisition has to be approved again at the new figure.
 */
export function needsReapproval(approvedValue: number, orderValue: number, tolerancePercent: number): boolean {
    return round2(orderValue) > round2(approvedValue * (1 + tolerancePercent / 100));
}

// ───────────────────────── quotations ─────────────────────────

export type QuoteBand = { from: number; quotes: number };

/** How many quotations a purchase of this value needs under the council's rule. */
export function requiredQuotes(value: number, bands: QuoteBand[]): number {
    const sorted = [...bands].sort((a, b) => a.from - b.from);
    let required = 1;
    for (const band of sorted) if (round2(value) >= round2(band.from)) required = band.quotes;
    return required;
}

/**
 * Why a purchase requisition's quotations do not yet allow it to be
 * submitted, or null. The rule is read at the chosen quotation's value,
 * because that is the price being approved. `today` is the workshop's date,
 * `YYYY-MM-DD`.
 */
export function quoteError(input: { quotes: { amount: number; chosen: boolean; validUntil: string | null }[]; bands: QuoteBand[]; today: string }): string | null {
    const chosen = input.quotes.filter((q) => q.chosen);
    if (input.quotes.length === 0) return "Attach the quotation for what is being bought.";
    if (chosen.length !== 1) return "Choose the quotation to approve.";
    const required = requiredQuotes(chosen[0].amount, input.bands);
    if (input.quotes.length < required) {
        return `A purchase of this value needs ${required} quotations. It has ${input.quotes.length}.`;
    }
    if (chosen[0].validUntil && chosen[0].validUntil < input.today) return "The chosen quotation has expired. Get a fresh one, or choose another.";
    return null;
}

// ───────────────────────── the paying division ─────────────────────────

/**
 * The paying division's fleet coordinator may sign once the workshop has
 * approved it — "approved against the vote" or "witnessed" — and only once.
 * Neither holds the requisition up.
 */
export function payerError(state: RequisitionState, alreadySigned: boolean): string | null {
    if (state !== "APPROVED" && state !== "AWAITING_FINALISE") return "The workshop has not approved it yet.";
    if (alreadySigned) return "The paying division has already signed it.";
    return null;
}

// ───────────────────────── finalising ─────────────────────────

/**
 * Why this person cannot sign this finalising box, or null. Nobody signs two
 * boxes of the finalisation, for the same reason nobody signs two approvals.
 */
export function finaliseError(input: { state: RequisitionState; step: FinalStep; signedSteps: RequisitionStep[]; signerSigned: FinalStep[] }): string | null {
    if (input.state !== "AWAITING_FINALISE") return "It is not waiting to be finalised.";
    if (input.signedSteps.includes(input.step)) return "That box has already been signed.";
    const other = input.signerSigned.find((s) => s !== input.step);
    if (other) return `You have already signed it as ${STEP_LABEL[other].toLowerCase()}. Another person signs this box.`;
    return null;
}

/** Finalised once the foreman, the fleet coordinator and the divisional head have all signed. */
export function finalised(signedSteps: RequisitionStep[]): boolean {
    return FINAL_REQUIRED.every((s) => signedSteps.includes(s));
}

// ───────────────────────── cancelling ─────────────────────────

/**
 * Why this person cannot cancel the requisition now, or null if they can.
 * Before approval the requester may withdraw their own request; afterwards
 * stores may already be acting on it, so only an owner or admin cancels, and
 * only while nothing has been issued or ordered.
 */
export function cancelError(input: { state: RequisitionState; isRequester: boolean; canManage: boolean; issuedOrOrdered: boolean }): string | null {
    if (input.state === "CANCELLED") return "This requisition is already cancelled.";
    if (input.state === "REJECTED" || input.state === "CLOSED") return "This requisition is closed.";
    if (input.state === "APPROVED" || input.state === "AWAITING_FINALISE") {
        if (!input.canManage) return "It has been approved, so only an owner or admin can cancel it.";
        if (input.issuedOrOrdered) return "Goods have already been issued or ordered against it. Finalise it instead.";
        return null;
    }
    if (!input.isRequester && !input.canManage) return "Only the person who raised it, or an owner or admin, can cancel it.";
    return null;
}
