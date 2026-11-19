import "server-only";
import type { RequisitionDecision, RequisitionState, RequisitionStep, Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { fullName } from "@/lib/format";
import { requisitionSettings } from "@/lib/settings/schema";
import {
    awaiting,
    cancelError,
    decisionError,
    editable,
    eligibleSigners,
    foremanStepRaisedByForeman,
    requisitionValue,
    STEP_LABEL,
    stateAfter,
    stepOf,
    stepsFor,
    submitError,
    unsignableStep,
    type ApprovalStep,
    type Assignment,
    type Decision,
} from "@/lib/requisitions/rules";

/**
 * Requisitions, inside transactions: writing one, submitting it, and each
 * signature on it. Issuing from stores and ordering what is not on the shelf
 * come later and read what is written here.
 *
 * Every move that changes the state claims it first — `updateMany` on the id
 * *and* the state the screen was showing — so two approvers with the same
 * requisition open, or one double tap, sign once. The loser is told to refresh
 * rather than silently signing a requisition that has already moved on.
 *
 * Errors are thrown as sentences for the person at the screen; the action
 * passes them through unchanged.
 */

export type RequisitionLineInput = {
    productId: string | null;
    description: string;
    quantity: number;
    unitCost: number;
    note?: string | null;
};

export type RequisitionInput = {
    departmentId: string | null;
    location?: string | null;
    /** `YYYY-MM-DD`, the workshop's own date. */
    requiredBy?: string | null;
    purpose?: string | null;
    chargeDocumentId: string | null;
    chargeVoteId: string | null;
    lines: RequisitionLineInput[];
};

/** The person acting: their place in this workshop, and whether they may run it. */
export type Actor = { membershipId: string; userId: string; canManage?: boolean };

const day = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
const text = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

/** A draft is written, and rewritten, by the person who raised it — nobody else's request is theirs to change. */
export async function saveRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string | null, input: RequisitionInput): Promise<string> {
    if (id) {
        const existing = await tx.requisition.findUnique({ where: { id }, select: { state: true, requestedById: true } });
        if (!existing) throw new Error("This requisition no longer exists. Refresh the page.");
        if (existing.requestedById !== actor.membershipId) throw new Error("Only the person who raised it can change it.");
        if (!editable(existing.state)) throw new Error("It has been submitted, so it can no longer be changed. Withdraw it first, or ask the approver to return it.");
    }
    if (input.departmentId) {
        const department = await tx.department.findFirst({ where: { id: input.departmentId, archivedAt: null }, select: { id: true } });
        if (!department) throw new Error("Choose a department from the list.");
    }
    if (input.chargeVoteId) {
        const vote = await tx.vote.findFirst({ where: { id: input.chargeVoteId, archivedAt: null }, select: { id: true } });
        if (!vote) throw new Error("Choose a vote from the list.");
    }
    if (input.chargeDocumentId) {
        // A job keeps its job number when the card becomes an invoice, so that is what makes it a job.
        const job = await tx.document.findFirst({ where: { id: input.chargeDocumentId, jobNumber: { not: null }, state: { not: "VOID" } }, select: { id: true } });
        if (!job) throw new Error("Choose an open job card to charge it to.");
    }

    const productIds = [...new Set(input.lines.map((l) => l.productId).filter((x): x is string => !!x))];
    const products = new Map(
        (await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, itemCode: true } })).map((p) => [p.id, p.itemCode]),
    );
    if (products.size !== productIds.length) throw new Error("One of the items is no longer in the product list. Choose it again.");

    const header = {
        departmentId: input.departmentId,
        location: text(input.location),
        requiredBy: day(input.requiredBy),
        purpose: text(input.purpose),
        chargeDocumentId: input.chargeDocumentId,
        chargeVoteId: input.chargeVoteId,
        value: requisitionValue(input.lines),
    };

    let requisitionId = id;
    if (requisitionId) {
        await tx.requisition.update({ where: { id: requisitionId }, data: header });
        // A draft has nothing issued or ordered against it, so its lines are simply rewritten.
        await tx.requisitionLine.deleteMany({ where: { requisitionId } });
    } else {
        const created = await tx.requisition.create({ data: { tenantId: tenant.id, requestedById: actor.membershipId, ...header }, select: { id: true } });
        requisitionId = created.id;
    }
    await tx.requisitionLine.createMany({
        data: input.lines.map((line, sortOrder) => ({
            tenantId: tenant.id,
            requisitionId: requisitionId!,
            sortOrder,
            productId: line.productId,
            itemCode: line.productId ? products.get(line.productId) ?? null : null,
            description: line.description.trim(),
            quantity: line.quantity,
            unitCost: line.unitCost,
            note: text(line.note),
        })),
    });
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: requisitionId, action: id ? "UPDATED" : "CREATED" },
    });
    return requisitionId;
}

/** Only a draft that was never submitted may be thrown away: once it has a number, the number is accounted for. */
export async function deleteDraft(tx: TenantTx, tenant: Tenant, actor: Actor, id: string): Promise<void> {
    const existing = await tx.requisition.findUnique({ where: { id }, select: { state: true, number: true, requestedById: true } });
    if (!existing) return;
    if (existing.requestedById !== actor.membershipId) throw new Error("Only the person who raised it can delete it.");
    if (existing.number || existing.state !== "DRAFT") throw new Error("It has a number, so it cannot be deleted. Cancel it instead, and the number stays accounted for.");
    await tx.requisition.delete({ where: { id } });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "DELETED" } });
}

async function assignmentsOf(tx: TenantTx): Promise<Assignment[]> {
    // Somebody who has left the workshop can no longer sign, whatever they were assigned.
    const rows = await tx.requisitionApprover.findMany({
        where: { membership: { status: "ACTIVE" } },
        select: { step: true, departmentId: true, membershipId: true, deputy: true },
    });
    return rows.filter((r): r is typeof r & { step: ApprovalStep } => r.step !== "REQUESTED");
}

async function signer(tx: TenantTx, membershipId: string): Promise<{ name: string; payNumber: string | null }> {
    const m = await tx.membership.findUnique({ where: { id: membershipId }, select: { payNumber: true, user: { select: { firstName: true, lastName: true } } } });
    if (!m) throw new Error("Your place in this workshop could not be found. Sign in again.");
    return { name: fullName(m.user), payNumber: m.payNumber };
}

async function sign(
    tx: TenantTx,
    tenant: Tenant,
    input: { requisitionId: string; step: RequisitionStep; decision: RequisitionDecision; membershipId: string; role: string; value: number; comment?: string | null; at: Date },
): Promise<void> {
    const who = await signer(tx, input.membershipId);
    await tx.requisitionSignoff.create({
        data: {
            tenantId: tenant.id,
            requisitionId: input.requisitionId,
            step: input.step,
            decision: input.decision,
            membershipId: input.membershipId,
            name: who.name,
            role: input.role,
            payNumber: who.payNumber,
            value: input.value,
            comment: text(input.comment),
            at: input.at,
        },
    });
}

/**
 * The signatures of the round in progress. A requisition returned for changes
 * and submitted again starts a new round: what was approved before covered a
 * different request. Rounds are told apart by the submission that opened them,
 * so every signature is stamped with the application's clock rather than the
 * transaction's start, which two signatures in one transaction would share.
 */
async function signedThisRound(tx: TenantTx, requisitionId: string): Promise<string[]> {
    const opened = await tx.requisitionSignoff.findFirst({
        where: { requisitionId, decision: "SUBMITTED" },
        orderBy: { at: "desc" },
        select: { at: true },
    });
    if (!opened) return [];
    const approvals = await tx.requisitionSignoff.findMany({
        where: { requisitionId, decision: "APPROVED", at: { gte: opened.at } },
        select: { membershipId: true },
    });
    return approvals.map((a) => a.membershipId).filter((x): x is string => !!x);
}

/**
 * Send a draft for signature. The number is issued now — on first submission,
 * like the red serial on the paper form — and kept if it is returned and sent
 * again. Refused if any step has nobody able to sign it, so nothing is
 * submitted into a queue nobody reads.
 */
export async function submitRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string): Promise<{ number: string; state: RequisitionState }> {
    const req = await tx.requisition.findUnique({
        where: { id },
        select: {
            state: true, number: true, requestedById: true, departmentId: true, chargeDocumentId: true, chargeVoteId: true, value: true, submittedAt: true,
            lines: { select: { description: true, quantity: true } },
        },
    });
    if (!req) throw new Error("This requisition no longer exists. Refresh the page.");
    if (req.requestedById !== actor.membershipId) throw new Error("Only the person who raised it can submit it.");
    const problem = submitError({ ...req, lines: req.lines.map((l) => ({ description: l.description, quantity: l.quantity.toNumber() })) });
    if (problem) throw new Error(problem);

    const value = req.value.toNumber();
    const assignments = await assignmentsOf(tx);
    const who = { departmentId: req.departmentId, requesterId: actor.membershipId, assignments };
    const steps = stepsFor(value, requisitionSettings(tenant.settings).overLimitAt);
    const unsignable = unsignableStep(steps, who);
    if (unsignable) throw new Error(unsignable);

    const raisedByForeman = foremanStepRaisedByForeman(who);
    const first = raisedByForeman ? steps[1] : steps[0];
    const number = req.number ?? (await allocateNumber(tx, tenant.id, "REQUISITION"));
    const now = new Date();

    const claimed = await tx.requisition.updateMany({
        where: { id, state: "DRAFT" },
        data: { state: awaiting(first), number, submittedAt: req.submittedAt ?? now },
    });
    if (claimed.count !== 1) throw new Error("It has just been submitted from somewhere else. Refresh the page.");

    await sign(tx, tenant, { requisitionId: id, step: "REQUESTED", decision: "SUBMITTED", membershipId: actor.membershipId, role: STEP_LABEL.REQUESTED, value, at: now });
    if (raisedByForeman) {
        await sign(tx, tenant, {
            requisitionId: id, step: "FOREMAN", decision: "RAISED_BY_FOREMAN", membershipId: actor.membershipId, role: STEP_LABEL.FOREMAN, value,
            comment: "Raised by the section's only foreman; the divisional head signs next.", at: new Date(now.getTime() + 1),
        });
    }
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "SUBMITTED", diff: { number, value } },
    });
    return { number, state: awaiting(first) };
}

/**
 * One signature: approve, return for changes, or reject. Only somebody
 * assigned to the step now waiting may sign it, never the requester, and
 * never somebody who has already signed another step of this round.
 */
export async function decideRequisition(
    tx: TenantTx,
    tenant: Tenant,
    actor: Actor,
    id: string,
    decision: Decision,
    comment?: string | null,
): Promise<{ state: RequisitionState }> {
    const req = await tx.requisition.findUnique({ where: { id }, select: { state: true, requestedById: true, departmentId: true, value: true } });
    if (!req) throw new Error("This requisition no longer exists. Refresh the page.");
    const step = stepOf(req.state);
    if (!step) throw new Error("This requisition is not waiting on a signature.");
    const missing = decisionError(decision, comment);
    if (missing) throw new Error(missing);

    const signed = await signedThisRound(tx, id);
    const eligible = eligibleSigners(step, { departmentId: req.departmentId, requesterId: req.requestedById, signedThisRound: signed, assignments: await assignmentsOf(tx) });
    const mine = eligible.find((a) => a.membershipId === actor.membershipId);
    if (!mine) {
        if (actor.membershipId === req.requestedById) throw new Error("You raised this requisition, so somebody else has to sign it.");
        if (signed.includes(actor.membershipId)) throw new Error("You have already signed this requisition. Another person signs this step.");
        throw new Error(`You are not assigned to sign the ${STEP_LABEL[step].toLowerCase()} step for this department.`);
    }

    const value = req.value.toNumber();
    const steps = stepsFor(value, requisitionSettings(tenant.settings).overLimitAt);
    // The limit can move while a requisition waits. If the step being signed is no longer needed, this signature is the last.
    const next = decision === "APPROVED" && !steps.includes(step) ? "APPROVED" : stateAfter(decision, step, steps);
    const now = new Date();
    const claimed = await tx.requisition.updateMany({
        where: { id, state: req.state },
        data: { state: next, approvedAt: next === "APPROVED" ? now : undefined, closedAt: next === "REJECTED" ? now : undefined },
    });
    if (claimed.count !== 1) throw new Error("Somebody else has just signed it. Refresh the page.");

    await sign(tx, tenant, {
        requisitionId: id, step, decision, membershipId: actor.membershipId,
        role: mine.deputy ? `${STEP_LABEL[step]} (deputy)` : STEP_LABEL[step], value, comment, at: now,
    });
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: decision, diff: { step, state: next } },
    });
    return { state: next };
}

/** The requester takes it back to change it, before it is approved. Every approval of the round is cleared by the new round it will start. */
export async function withdrawRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string): Promise<void> {
    const req = await tx.requisition.findUnique({ where: { id }, select: { state: true, requestedById: true, value: true } });
    if (!req) throw new Error("This requisition no longer exists. Refresh the page.");
    if (req.requestedById !== actor.membershipId) throw new Error("Only the person who raised it can withdraw it.");
    if (!stepOf(req.state)) throw new Error("Only a requisition waiting on a signature can be withdrawn.");
    const claimed = await tx.requisition.updateMany({ where: { id, state: req.state }, data: { state: "DRAFT" } });
    if (claimed.count !== 1) throw new Error("Somebody has just signed it. Refresh the page.");
    await sign(tx, tenant, {
        requisitionId: id, step: "REQUESTED", decision: "RETURNED", membershipId: actor.membershipId, role: STEP_LABEL.REQUESTED,
        value: req.value.toNumber(), comment: "Withdrawn by the requester to change it.", at: new Date(),
    });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "WITHDRAWN" } });
}

/** Cancelled, with the reason, and the number kept: a cancelled requisition is part of the sequence an auditor checks. */
export async function cancelRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string, reason: string): Promise<void> {
    const req = await tx.requisition.findUnique({ where: { id }, select: { state: true, number: true, requestedById: true, value: true } });
    if (!req) throw new Error("This requisition no longer exists. Refresh the page.");
    if (!reason.trim()) throw new Error("Give the reason for cancelling it.");
    const [issued, ordered] = await Promise.all([
        tx.stockMovement.count({ where: { requisitionLine: { requisitionId: id } } }),
        tx.purchaseOrderLine.count({ where: { requisitionLine: { requisitionId: id } } }),
    ]);
    const problem = cancelError({
        state: req.state,
        isRequester: req.requestedById === actor.membershipId,
        canManage: !!actor.canManage,
        issuedOrOrdered: issued + ordered > 0,
    });
    if (problem) throw new Error(problem);

    const now = new Date();
    const claimed = await tx.requisition.updateMany({ where: { id, state: req.state }, data: { state: "CANCELLED", cancelledAt: now, cancelReason: reason.trim() } });
    if (claimed.count !== 1) throw new Error("It has just changed. Refresh the page.");
    if (req.number) {
        await sign(tx, tenant, {
            requisitionId: id, step: stepOf(req.state) ?? "REQUESTED", decision: "CANCELLED", membershipId: actor.membershipId,
            role: actor.membershipId === req.requestedById ? STEP_LABEL.REQUESTED : "Cancelled by", value: req.value.toNumber(), comment: reason, at: now,
        });
    }
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "CANCELLED", diff: { number: req.number, reason: reason.trim() } },
    });
}
