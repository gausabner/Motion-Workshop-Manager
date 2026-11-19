import type { RequisitionState, RequisitionStep } from "@prisma/client";
import { round2 } from "@/lib/documents/totals";

/**
 * The rules of a requisition, as pure functions.
 *
 * Benchmarked on a council's paper "Requisition for Supplies": the requester
 * asks, the foreman signs, the divisional head (the manager) signs, and above
 * the council's own value limit one more person signs. Decided with the owner
 * of the business on 19 November 2026; the brief is
 * `docs/requisitions-plan.md`.
 *
 * Approval is by assignment, not by role, so these functions are handed the
 * assignments and the signatures already on the requisition and decide from
 * those alone. Kept free of the database so the screen, the action and the
 * tests all reach the same answer.
 */

/** The steps somebody signs, as opposed to the requester submitting. */
export type ApprovalStep = Exclude<RequisitionStep, "REQUESTED">;

export const STEP_LABEL: Record<RequisitionStep, string> = {
    REQUESTED: "Requisitioned by",
    FOREMAN: "Foreman",
    DIVISIONAL_HEAD: "Divisional Head",
    OVER_LIMIT: "Over the value limit",
};

const AWAITING: Record<ApprovalStep, RequisitionState> = {
    FOREMAN: "AWAITING_FOREMAN",
    DIVISIONAL_HEAD: "AWAITING_HEAD",
    OVER_LIMIT: "AWAITING_OVER_LIMIT",
};

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

/** The step a requisition is waiting on, or null when it is waiting on nobody's signature. */
export function stepOf(state: RequisitionState): ApprovalStep | null {
    for (const [step, s] of Object.entries(AWAITING) as [ApprovalStep, RequisitionState][]) if (s === state) return step;
    return null;
}

export function awaiting(step: ApprovalStep): RequisitionState {
    return AWAITING[step];
}

/** Lines, quantities and the charge change only while it is a draft: an approval covers what was approved. */
export function editable(state: RequisitionState): boolean {
    return state === "DRAFT";
}

/** The value of the lines excluding VAT, to the cent — the form's "Value". */
export function requisitionValue(lines: { quantity: number; unitCost: number }[]): number {
    return round2(lines.reduce((sum, l) => sum + round2(l.quantity * l.unitCost), 0));
}

export type Assignment = { step: ApprovalStep; departmentId: string | null; membershipId: string; deputy: boolean };

function assignedTo(step: ApprovalStep, departmentId: string | null, assignments: Assignment[]): Assignment[] {
    // The value limit is the council's, so its approvers have no department.
    const scope = step === "OVER_LIMIT" ? null : departmentId;
    return assignments.filter((a) => a.step === step && a.departmentId === scope);
}

/**
 * Who may sign `step` on this requisition now. Nobody signs their own
 * request, and nobody signs two steps of one round: the foreman and the
 * divisional head are two checks only while they are two people.
 * A deputy signs in the principal's place, and the signature says so.
 */
export function eligibleSigners(
    step: ApprovalStep,
    input: { departmentId: string | null; requesterId: string; signedThisRound: string[]; assignments: Assignment[] },
): Assignment[] {
    const signed = new Set(input.signedThisRound);
    return assignedTo(step, input.departmentId, input.assignments).filter(
        (a) => a.membershipId !== input.requesterId && !signed.has(a.membershipId),
    );
}

/**
 * A foreman asking for their own section has nobody to sign the foreman step
 * unless another foreman, or a deputy, is assigned. Then the step is recorded
 * as raised by the foreman and the divisional head signs next — written down,
 * never skipped in silence.
 */
export function foremanStepRaisedByForeman(input: { departmentId: string | null; requesterId: string; assignments: Assignment[] }): boolean {
    const foremen = assignedTo("FOREMAN", input.departmentId, input.assignments);
    const requesterIsForeman = foremen.some((a) => a.membershipId === input.requesterId);
    return requesterIsForeman && foremen.every((a) => a.membershipId === input.requesterId);
}

/**
 * Why a draft cannot be submitted yet, in words for the requester, or null.
 * Checked on the screen and again in the action.
 */
export function submitError(input: {
    state: RequisitionState;
    lines: { description: string; quantity: number }[];
    departmentId: string | null;
    chargeDocumentId: string | null;
    chargeVoteId: string | null;
}): string | null {
    if (input.state !== "DRAFT") return "This requisition has already been submitted.";
    if (!input.departmentId) return "Choose the department asking for these.";
    if (input.lines.length === 0) return "Add at least one line.";
    if (input.lines.some((l) => !l.description.trim())) return "Every line needs a description.";
    if (input.lines.some((l) => !(l.quantity > 0))) return "Every line needs a quantity of more than zero.";
    if (input.chargeDocumentId && input.chargeVoteId) return "Charge it to a job card or to a vote, not both.";
    if (!input.chargeDocumentId && !input.chargeVoteId) return "Charge it to a job card or to a vote.";
    return null;
}

/**
 * Whether every step this requisition needs has somebody able to sign it.
 * Without this check a requisition could be submitted into a queue nobody
 * reads; the requester is told now, and told who can fix it.
 */
export function unsignableStep(
    steps: ApprovalStep[],
    input: { departmentId: string | null; requesterId: string; assignments: Assignment[] },
): string | null {
    for (const step of steps) {
        if (step === "FOREMAN" && foremanStepRaisedByForeman(input)) continue;
        if (eligibleSigners(step, { ...input, signedThisRound: [] }).length === 0) {
            const who = step === "OVER_LIMIT" ? "the value limit" : `the ${STEP_LABEL[step].toLowerCase()} step for this department`;
            return `Nobody is assigned to sign ${who}. An owner or admin assigns approvers in Settings.`;
        }
    }
    return null;
}

export type Decision = "APPROVED" | "RETURNED" | "REJECTED";

/** Where a requisition goes after `step` is decided. */
export function stateAfter(decision: Decision, step: ApprovalStep, steps: ApprovalStep[]): RequisitionState {
    if (decision === "RETURNED") return "DRAFT";
    if (decision === "REJECTED") return "REJECTED";
    const next = steps[steps.indexOf(step) + 1];
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

/**
 * Why this person cannot cancel the requisition now, or null if they can.
 * Before approval the requester may withdraw their own request; afterwards
 * stores may already be acting on it, so only an owner or admin cancels, and
 * only while nothing has been issued or ordered.
 */
export function cancelError(input: {
    state: RequisitionState;
    isRequester: boolean;
    canManage: boolean;
    issuedOrOrdered: boolean;
}): string | null {
    if (input.state === "CANCELLED") return "This requisition is already cancelled.";
    if (input.state === "REJECTED" || input.state === "CLOSED") return "This requisition is closed.";
    if (input.state === "APPROVED") {
        if (!input.canManage) return "It has been approved, so only an owner or admin can cancel it.";
        if (input.issuedOrOrdered) return "Goods have already been issued or ordered against it. Close it instead.";
        return null;
    }
    if (!input.isRequester && !input.canManage) return "Only the person who raised it, or an owner or admin, can cancel it.";
    return null;
}
