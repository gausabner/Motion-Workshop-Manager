import "server-only";
import type { RequisitionDecision, RequisitionKind, RequisitionState, RequisitionStep, Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { fullName } from "@/lib/format";
import { requisitionSettings } from "@/lib/settings/schema";
import { businessToday } from "@/lib/tenant/today";
import {
    approvalValue,
    awaiting,
    cancelError,
    candidatesFor,
    decisionError,
    editable,
    eligible,
    finaliseError,
    finalised,
    FITTER_DESIGNATIONS,
    foremanStepRaisedByForeman,
    payerError,
    payingUnit,
    quoteError,
    requisitionValue,
    STEP_LABEL,
    stateAfter,
    stepOf,
    stepsFor,
    submitError,
    unsignableStep,
    type ApprovalStep,
    type Authority,
    type Candidate,
    type Decision,
    type FinalStep,
    type Scope,
} from "@/lib/requisitions/rules";

/**
 * Requisitions, inside transactions: writing one, its quotations, submitting
 * it, and every signature on it — approval, the paying division's, and the
 * finalising ones. Issuing from stores and ordering come later and read what
 * is written here.
 *
 * Every move that changes the state claims it first — `updateMany` on the id
 * *and* the state the screen was showing — so two approvers with the same
 * requisition open, or one double tap, sign once. Finalising, where several
 * people sign different boxes at the same moment, locks the row instead, so
 * exactly one of them closes it.
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
    kind: RequisitionKind;
    workshopId: string | null;
    location?: string | null;
    /** `YYYY-MM-DD`, the workshop's own date. */
    requiredBy?: string | null;
    purpose?: string | null;
    chargeDocumentId: string | null;
    chargeVoteId: string | null;
    /** A purchase requisition split from a stores requisition names it. */
    sourceRequisitionId?: string | null;
    lines: RequisitionLineInput[];
};

export type QuoteInput = {
    supplierId: string;
    /** Excluding VAT. */
    amount: number;
    reference?: string | null;
    /** `YYYY-MM-DD`. */
    validUntil?: string | null;
    note?: string | null;
};

/** The person acting: their place in this workshop, and what their role lets them do. */
export type Actor = { membershipId: string; userId: string; canManage?: boolean; canIssue?: boolean };

const day = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);
const text = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const MISSING = "This requisition no longer exists. Refresh the page.";

// ───────────────────────── writing ─────────────────────────

/** A draft is written, and rewritten, by the person who raised it — nobody else's request is theirs to change. */
export async function saveRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string | null, input: RequisitionInput): Promise<string> {
    if (id) {
        const existing = await tx.requisition.findUnique({ where: { id }, select: { state: true, requestedById: true, kind: true } });
        if (!existing) throw new Error(MISSING);
        if (existing.requestedById !== actor.membershipId) throw new Error("Only the person who raised it can change it.");
        if (!editable(existing.state)) throw new Error("It has been submitted, so it can no longer be changed. Withdraw it first, or ask the approver to return it.");
        if (existing.kind !== input.kind) throw new Error("A requisition stays the kind it was raised as. Raise a new one instead.");
    }
    if (input.workshopId) {
        const workshop = await tx.workshop.findFirst({ where: { id: input.workshopId, archivedAt: null }, select: { id: true } });
        if (!workshop) throw new Error("Choose a workshop from the list.");
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
    if (input.sourceRequisitionId) {
        if (input.kind !== "PURCHASE") throw new Error("Only a purchase requisition is split from another.");
        const source = await tx.requisition.findUnique({ where: { id: input.sourceRequisitionId }, select: { kind: true } });
        if (source?.kind !== "STORES") throw new Error("A purchase requisition is split from a stores requisition.");
    }

    const productIds = [...new Set(input.lines.map((l) => l.productId).filter((x): x is string => !!x))];
    const products = new Map(
        (await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, itemCode: true } })).map((p) => [p.id, p.itemCode]),
    );
    if (products.size !== productIds.length) throw new Error("One of the items is no longer in the product list. Choose it again.");

    const header = {
        workshopId: input.workshopId,
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
        const created = await tx.requisition.create({
            data: { tenantId: tenant.id, kind: input.kind, sourceRequisitionId: input.sourceRequisitionId ?? null, requestedById: actor.membershipId, ...header },
            select: { id: true },
        });
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

// ───────────────────────── quotations ─────────────────────────

/**
 * Who may handle a draft purchase requisition's quotations: the person who
 * raised it, a parts driver (who is usually the one bringing them back), or
 * stores.
 */
async function quoteHandler(tx: TenantTx, actor: Actor, requisitionId: string): Promise<void> {
    const req = await tx.requisition.findUnique({ where: { id: requisitionId }, select: { state: true, kind: true, requestedById: true } });
    if (!req) throw new Error(MISSING);
    if (req.kind !== "PURCHASE") throw new Error("Only a purchase requisition carries quotations.");
    if (!editable(req.state)) throw new Error("It has been submitted, so its quotations can no longer change.");
    if (req.requestedById === actor.membershipId || actor.canIssue) return;
    const me = await tx.membership.findUnique({ where: { id: actor.membershipId }, select: { designations: true } });
    if (!me?.designations.includes("PARTS_DRIVER")) throw new Error("Only the person who raised it, a parts driver or stores can add its quotations.");
}

export async function addQuote(tx: TenantTx, tenant: Tenant, actor: Actor, requisitionId: string, input: QuoteInput): Promise<string> {
    await quoteHandler(tx, actor, requisitionId);
    if (!(input.amount > 0)) throw new Error("Enter the quotation's amount, excluding VAT.");
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { id: true } });
    if (!supplier) throw new Error("Choose the supplier who quoted.");
    const created = await tx.requisitionQuote.create({
        data: {
            tenantId: tenant.id,
            requisitionId,
            supplierId: input.supplierId,
            amount: input.amount,
            reference: text(input.reference),
            validUntil: day(input.validUntil),
            note: text(input.note),
            obtainedById: actor.membershipId,
        },
        select: { id: true },
    });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "RequisitionQuote", entityId: created.id, action: "CREATED" } });
    return created.id;
}

export async function removeQuote(tx: TenantTx, tenant: Tenant, actor: Actor, quoteId: string): Promise<void> {
    const quote = await tx.requisitionQuote.findUnique({ where: { id: quoteId }, select: { requisitionId: true } });
    if (!quote) return;
    await quoteHandler(tx, actor, quote.requisitionId);
    await tx.requisitionQuote.delete({ where: { id: quoteId } });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "RequisitionQuote", entityId: quoteId, action: "DELETED" } });
}

/** One quotation is the one put forward; choosing another unchooses the first. */
export async function chooseQuote(tx: TenantTx, tenant: Tenant, actor: Actor, quoteId: string): Promise<void> {
    const quote = await tx.requisitionQuote.findUnique({ where: { id: quoteId }, select: { requisitionId: true } });
    if (!quote) throw new Error("That quotation no longer exists. Refresh the page.");
    await quoteHandler(tx, actor, quote.requisitionId);
    await tx.requisitionQuote.updateMany({ where: { requisitionId: quote.requisitionId, chosen: true }, data: { chosen: false } });
    await tx.requisitionQuote.update({ where: { id: quoteId }, data: { chosen: true } });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "RequisitionQuote", entityId: quoteId, action: "CHOSEN" } });
}

// ───────────────────────── who may sign ─────────────────────────

/** The organisation, the appointments of people still in the workshop, and where this requisition sits. */
async function signingContext(tx: TenantTx, req: { workshopId: string | null; chargeVoteId: string | null }): Promise<{ scope: Scope; authorities: Authority[]; units: { id: string; parentId: string | null }[] }> {
    const [units, rows, workshop, vote] = await Promise.all([
        tx.orgUnit.findMany({ select: { id: true, parentId: true } }),
        // Somebody who has left the workshop can no longer sign, whatever they were appointed to.
        tx.signingAuthority.findMany({ where: { membership: { status: "ACTIVE" } }, select: { kind: true, workshopId: true, orgUnitId: true, membershipId: true, deputy: true } }),
        req.workshopId ? tx.workshop.findUnique({ where: { id: req.workshopId }, select: { orgUnitId: true } }) : null,
        req.chargeVoteId ? tx.vote.findUnique({ where: { id: req.chargeVoteId }, select: { orgUnitId: true } }) : null,
    ]);
    const workshopUnitId = workshop?.orgUnitId ?? null;
    return {
        scope: { workshopId: req.workshopId, workshopUnitId, payingUnitId: payingUnit({ voteUnitId: vote?.orgUnitId ?? null, workshopUnitId }) },
        authorities: rows,
        units,
    };
}

async function signer(tx: TenantTx, membershipId: string): Promise<{ name: string; payNumber: string | null; designations: string[] }> {
    const m = await tx.membership.findUnique({
        where: { id: membershipId },
        select: { payNumber: true, designations: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!m) throw new Error("Your place in this workshop could not be found. Sign in again.");
    return { name: fullName(m.user), payNumber: m.payNumber, designations: m.designations };
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

const role = (step: RequisitionStep, c: Candidate | undefined) => (c?.deputy ? `${STEP_LABEL[step]} (deputy)` : STEP_LABEL[step]);

/**
 * The approvals of the round in progress. A requisition returned for changes
 * and submitted again starts a new round: what was approved before covered a
 * different request. Rounds are told apart by the submission that opened them,
 * so every signature is stamped with the application's clock rather than the
 * transaction's start, which two signatures in one transaction would share.
 */
async function signedThisRound(tx: TenantTx, requisitionId: string): Promise<string[]> {
    const opened = await tx.requisitionSignoff.findFirst({ where: { requisitionId, decision: "SUBMITTED" }, orderBy: { at: "desc" }, select: { at: true } });
    if (!opened) return [];
    const approvals = await tx.requisitionSignoff.findMany({
        where: { requisitionId, decision: "APPROVED", step: { in: ["FOREMAN", "DIVISIONAL_HEAD", "OVER_LIMIT"] }, at: { gte: opened.at } },
        select: { membershipId: true },
    });
    return approvals.map((a) => a.membershipId).filter((x): x is string => !!x);
}

// ───────────────────────── submitting and approving ─────────────────────────

/**
 * Send a draft for approval. The number is issued now — on first submission,
 * like the red serial on the paper form — and kept if it is returned and sent
 * again. A purchase requisition goes with its quotations and is valued at the
 * one chosen. Refused if any step has nobody able to sign it, so nothing is
 * submitted into a queue nobody reads.
 */
export async function submitRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string): Promise<{ number: string; state: RequisitionState }> {
    const req = await tx.requisition.findUnique({
        where: { id },
        select: {
            state: true, kind: true, number: true, requestedById: true, workshopId: true, chargeDocumentId: true, chargeVoteId: true, value: true, submittedAt: true,
            lines: { select: { description: true, quantity: true } },
            quotes: { select: { amount: true, chosen: true, validUntil: true } },
        },
    });
    if (!req) throw new Error(MISSING);
    if (req.requestedById !== actor.membershipId) throw new Error("Only the person who raised it can submit it.");
    const problem = submitError({ ...req, lines: req.lines.map((l) => ({ description: l.description, quantity: l.quantity.toNumber() })) });
    if (problem) throw new Error(problem);

    const settings = requisitionSettings(tenant.settings);
    const quotes = req.quotes.map((q) => ({ amount: q.amount.toNumber(), chosen: q.chosen, validUntil: ymd(q.validUntil) }));
    if (req.kind === "PURCHASE") {
        const quoteProblem = quoteError({ quotes, bands: settings.quoteBands, today: ymd(businessToday(tenant.timezone))! });
        if (quoteProblem) throw new Error(quoteProblem);
    }
    const value = approvalValue(req.kind, req.value.toNumber(), quotes.find((q) => q.chosen)?.amount ?? null);

    const { scope, authorities, units } = await signingContext(tx, req);
    const candidates = {
        FOREMAN: candidatesFor("FOREMAN", scope, authorities, units),
        DIVISIONAL_HEAD: candidatesFor("DIVISIONAL_HEAD", scope, authorities, units),
        OVER_LIMIT: candidatesFor("OVER_LIMIT", scope, authorities, units),
    };
    const steps = stepsFor(value, settings.overLimitAt);
    const unsignable = unsignableStep(steps, candidates, actor.membershipId);
    if (unsignable) throw new Error(unsignable);

    const raisedByForeman = foremanStepRaisedByForeman(candidates.FOREMAN, actor.membershipId);
    const first = raisedByForeman ? steps[1] : steps[0];
    const number = req.number ?? (await allocateNumber(tx, tenant.id, "REQUISITION"));
    const now = new Date();

    const claimed = await tx.requisition.updateMany({
        where: { id, state: "DRAFT" },
        data: { state: awaiting(first), number, value, submittedAt: req.submittedAt ?? now },
    });
    if (claimed.count !== 1) throw new Error("It has just been submitted from somewhere else. Refresh the page.");

    await sign(tx, tenant, { requisitionId: id, step: "REQUESTED", decision: "SUBMITTED", membershipId: actor.membershipId, role: STEP_LABEL.REQUESTED, value, at: now });
    if (raisedByForeman) {
        await sign(tx, tenant, {
            requisitionId: id, step: "FOREMAN", decision: "RAISED_BY_FOREMAN", membershipId: actor.membershipId, role: STEP_LABEL.FOREMAN, value,
            comment: "Raised by the workshop's only foreman; the divisional head signs next.", at: new Date(now.getTime() + 1),
        });
    }
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: "SUBMITTED", diff: { number, value } },
    });
    return { number, state: awaiting(first) };
}

/**
 * One approval: approve, return for changes, or reject. Only somebody
 * appointed to the step now waiting may sign it, never the requester, and
 * never somebody who has already approved another step of this round.
 */
export async function decideRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string, decision: Decision, comment?: string | null): Promise<{ state: RequisitionState }> {
    const req = await tx.requisition.findUnique({ where: { id }, select: { state: true, requestedById: true, workshopId: true, chargeVoteId: true, value: true } });
    if (!req) throw new Error(MISSING);
    const step = stepOf(req.state);
    if (!step) throw new Error("This requisition is not waiting on an approval.");
    const missing = decisionError(decision, comment);
    if (missing) throw new Error(missing);

    const { scope, authorities, units } = await signingContext(tx, req);
    const signed = await signedThisRound(tx, id);
    const mine = eligible(candidatesFor(step, scope, authorities, units), { requesterId: req.requestedById, signedThisRound: signed }).find(
        (c) => c.membershipId === actor.membershipId,
    );
    if (!mine) {
        if (actor.membershipId === req.requestedById) throw new Error("You raised this requisition, so somebody else has to sign it.");
        if (signed.includes(actor.membershipId)) throw new Error("You have already approved this requisition. Another person signs this step.");
        throw new Error(`You are not appointed to sign the ${STEP_LABEL[step].toLowerCase()} step for this requisition.`);
    }

    const value = req.value.toNumber();
    const next = stateAfter(decision, step, stepsFor(value, requisitionSettings(tenant.settings).overLimitAt));
    const now = new Date();
    const claimed = await tx.requisition.updateMany({
        where: { id, state: req.state },
        data: { state: next, approvedAt: next === "APPROVED" ? now : undefined, closedAt: next === "REJECTED" ? now : undefined },
    });
    if (claimed.count !== 1) throw new Error("Somebody else has just signed it. Refresh the page.");

    await sign(tx, tenant, { requisitionId: id, step, decision, membershipId: actor.membershipId, role: role(step, mine), value, comment, at: now });
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: decision, diff: { step, state: next } },
    });
    return { state: next };
}

/** The requester takes it back to change it, before it is approved. The new round it starts clears this round's approvals. */
export async function withdrawRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string): Promise<void> {
    const req = await tx.requisition.findUnique({ where: { id }, select: { state: true, requestedById: true, value: true } });
    if (!req) throw new Error(MISSING);
    if (req.requestedById !== actor.membershipId) throw new Error("Only the person who raised it can withdraw it.");
    if (!stepOf(req.state)) throw new Error("Only a requisition waiting on an approval can be withdrawn.");
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
    if (!req) throw new Error(MISSING);
    if (!reason.trim()) throw new Error("Give the reason for cancelling it.");
    const [issued, ordered] = await Promise.all([
        tx.stockMovement.count({ where: { requisitionLine: { requisitionId: id } } }),
        tx.purchaseOrderLine.count({ where: { requisitionLine: { requisitionId: id } } }),
    ]);
    const problem = cancelError({ state: req.state, isRequester: req.requestedById === actor.membershipId, canManage: !!actor.canManage, issuedOrOrdered: issued + ordered > 0 });
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

// ───────────────────────── the paying division ─────────────────────────

/**
 * The paying division's fleet coordinator, told of a cost against their vote,
 * approves it against the vote or witnesses it. Either way the signature joins
 * the trail; neither holds the requisition up, and neither changes its state.
 */
export async function signForPayer(tx: TenantTx, tenant: Tenant, actor: Actor, id: string, decision: "APPROVED" | "WITNESSED", comment?: string | null): Promise<void> {
    const req = await tx.requisition.findUnique({ where: { id }, select: { state: true, workshopId: true, chargeVoteId: true, value: true } });
    if (!req) throw new Error(MISSING);
    const already = (await tx.requisitionSignoff.count({ where: { requisitionId: id, step: "PAYER" } })) > 0;
    const problem = payerError(req.state, already);
    if (problem) throw new Error(problem);
    const { scope, authorities, units } = await signingContext(tx, req);
    const mine = candidatesFor("PAYER", scope, authorities, units).find((c) => c.membershipId === actor.membershipId);
    if (!mine) throw new Error("Only the fleet coordinator of the division that pays for it can sign for that division.");
    await sign(tx, tenant, { requisitionId: id, step: "PAYER", decision, membershipId: actor.membershipId, role: role("PAYER", mine), value: req.value.toNumber(), comment, at: new Date() });
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: `PAYER_${decision}` } });
}

// ───────────────────────── finalising ─────────────────────────

/**
 * One finalising signature. The foreman, the paying division's fleet
 * coordinator and the divisional head must all sign; whoever fitted it may.
 * The row is locked first, so when the last two sign at the same moment
 * exactly one of them closes it.
 */
export async function finaliseRequisition(tx: TenantTx, tenant: Tenant, actor: Actor, id: string, step: FinalStep, comment?: string | null): Promise<{ state: RequisitionState }> {
    await tx.$queryRaw`SELECT 1 FROM "Requisition" WHERE "id" = ${id} FOR UPDATE`;
    const req = await tx.requisition.findUnique({ where: { id }, select: { state: true, workshopId: true, chargeVoteId: true, value: true } });
    if (!req) throw new Error(MISSING);
    const finals = await tx.requisitionSignoff.findMany({
        where: { requisitionId: id, step: { in: ["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD", "FINAL_FITTER"] } },
        select: { step: true, membershipId: true },
    });
    const problem = finaliseError({
        state: req.state,
        step,
        signedSteps: finals.map((f) => f.step),
        signerSigned: finals.filter((f) => f.membershipId === actor.membershipId).map((f) => f.step as FinalStep),
    });
    if (problem) throw new Error(problem);

    let candidate: Candidate | undefined;
    if (step === "FINAL_FITTER") {
        const me = await signer(tx, actor.membershipId);
        if (me.designations.some((d) => (FITTER_DESIGNATIONS as string[]).includes(d))) candidate = { membershipId: actor.membershipId, deputy: false };
        if (!candidate) throw new Error("Only a mechanic, artisan or intern signs as the one who fitted it.");
    } else {
        const { scope, authorities, units } = await signingContext(tx, req);
        candidate = candidatesFor(step, scope, authorities, units).find((c) => c.membershipId === actor.membershipId);
        if (!candidate) throw new Error(`You are not appointed to sign as ${STEP_LABEL[step].toLowerCase()} for this requisition.`);
    }

    const now = new Date();
    await sign(tx, tenant, { requisitionId: id, step, decision: "SIGNED", membershipId: actor.membershipId, role: role(step, candidate), value: req.value.toNumber(), comment, at: now });
    const done = finalised([...finals.map((f) => f.step), step]);
    if (done) await tx.requisition.update({ where: { id }, data: { state: "CLOSED", closedAt: now } });
    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "Requisition", entityId: id, action: done ? "FINALISED" : "FINALISE_SIGNED", diff: { step } },
    });
    return { state: done ? "CLOSED" : req.state };
}

export type { ApprovalStep, FinalStep };
