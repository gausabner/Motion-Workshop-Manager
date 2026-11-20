import "server-only";
import type { RequisitionKind, RequisitionState, RequisitionStep, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import type { ActionState } from "@/lib/forms";
import { can } from "@/lib/auth/permissions";
import { fullName } from "@/lib/format";
import { movesStock } from "@/lib/stock/rules";
import { candidatesFor, cancelError, editable, eligible, finaliseError, FITTER_DESIGNATIONS, STEP_LABEL, stepOf, type FinalStep } from "@/lib/requisitions/rules";
import { outstanding, OPEN_STATES } from "@/lib/requisitions/stores-rules";
import { signedThisRound, signingContext } from "@/lib/requisitions/service";
import { issuedByLine } from "@/lib/requisitions/stores";

/**
 * A requisition as its screen shows it, and what the person looking may do
 * with it now. Plain values only, so it crosses to the client unchanged and
 * every action can answer with a fresh one.
 */

export const STATE_LABEL: Record<RequisitionState, string> = {
    DRAFT: "Draft",
    AWAITING_FOREMAN: "Waiting for the foreman",
    AWAITING_HEAD: "Waiting for the divisional head",
    AWAITING_OVER_LIMIT: "Waiting for the over-limit approver",
    APPROVED: "Approved",
    AWAITING_FINALISE: "Issued, to be finalised",
    CLOSED: "Closed",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
};

const FINAL_STEPS: FinalStep[] = ["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD", "FINAL_FITTER"];

export type RequisitionView = {
    id: string;
    number: string | null;
    kind: RequisitionKind;
    state: RequisitionState;
    workshop: { id: string; name: string } | null;
    location: string | null;
    requiredBy: string | null;
    purpose: string | null;
    charge: { kind: "JOB"; id: string; label: string } | { kind: "VOTE"; id: string; label: string } | null;
    requestedBy: string;
    createdAt: string;
    value: number;
    lines: { id: string; productId: string | null; itemCode: string | null; description: string; quantity: number; unitCost: number; note: string | null; issued: number; outstanding: number; onHand: number | null; stocked: boolean }[];
    signoffs: { id: string; step: RequisitionStep; stepLabel: string; decision: string; name: string; role: string; payNumber: string | null; comment: string | null; at: string }[];
    issues: { id: string; at: string; issuedBy: string; receiverName: string; receiverPayNumber: string | null; lines: { description: string; quantity: number }[] }[];
    /** Who the current step waits on, by name. */
    waitingOn: string[];
    can: {
        edit: boolean;
        submit: boolean;
        discard: boolean;
        withdraw: boolean;
        decide: { step: string } | null;
        issue: boolean;
        finalise: { step: FinalStep; label: string }[];
        cancel: boolean;
    };
};

/** What a requisition action answers with: the outcome, and the requisition as it now stands. */
export type RequisitionAnswer = ActionState & { view?: RequisitionView };

type Viewer = { id: string; group: string; extraPermissions: string[]; designations: string[] };

export async function requisitionView(db: TenantDb, tenant: Tenant, id: string, viewer: Viewer): Promise<RequisitionView | null> {
    const req = await db.requisition.findUnique({
        where: { id },
        select: {
            id: true, number: true, kind: true, state: true, location: true, requiredBy: true, purpose: true, value: true, createdAt: true,
            workshopId: true, chargeVoteId: true, chargeDocumentId: true, requestedById: true,
            workshop: { select: { id: true, name: true } },
            requestedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            chargeDocument: { select: { id: true, jobNumber: true, number: true, vehicle: { select: { plate: true } } } },
            chargeVote: { select: { id: true, code: true, name: true } },
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, productId: true, itemCode: true, description: true, quantity: true, unitCost: true, note: true, product: { select: { qtyOnHand: true, type: true, isService: true, dontUpdateQty: true } } } },
            signoffs: { orderBy: { at: "asc" }, select: { id: true, step: true, decision: true, membershipId: true, name: true, role: true, payNumber: true, comment: true, at: true } },
            issues: { orderBy: { at: "asc" }, select: { id: true, at: true, receiverName: true, receiverPayNumber: true, issuedBy: { select: { user: { select: { firstName: true, lastName: true } } } }, stockMovements: { select: { quantity: true, requisitionLine: { select: { description: true } } } } } },
        },
    });
    if (!req) return null;
    const issued = await issuedByLine(db, req.lines.map((l) => l.id));
    const mine = req.requestedById === viewer.id;
    const member = viewer as Parameters<typeof can>[0];

    // Who may sign the step it waits on, and whether that is the person looking.
    const step = stepOf(req.state);
    let waitingOn: string[] = [];
    let decide: RequisitionView["can"]["decide"] = null;
    const finalise: RequisitionView["can"]["finalise"] = [];
    if (step || req.state === "AWAITING_FINALISE") {
        const { scope, authorities, units } = await signingContext(db, req);
        if (step) {
            const signed = await signedThisRound(db, id);
            const who = eligible(candidatesFor(step, scope, authorities, units), { requesterId: req.requestedById, signedThisRound: signed });
            const people = await db.membership.findMany({ where: { id: { in: who.map((c) => c.membershipId) } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } });
            waitingOn = people.map((p) => fullName(p.user));
            if (who.some((c) => c.membershipId === viewer.id)) decide = { step: STEP_LABEL[step] };
        } else {
            const finals = req.signoffs.filter((s) => (FINAL_STEPS as string[]).includes(s.step));
            const signerSigned = finals.filter((f) => f.membershipId === viewer.id).map((f) => f.step as FinalStep);
            for (const final of FINAL_STEPS) {
                const holds =
                    final === "FINAL_FITTER"
                        ? viewer.designations.some((d) => (FITTER_DESIGNATIONS as string[]).includes(d))
                        : candidatesFor(final, scope, authorities, units).some((c) => c.membershipId === viewer.id);
                // Nobody signs two boxes of the finalisation; the rule says so, and the screen offers only what it allows.
                if (holds && !finaliseError({ state: req.state, step: final, signedSteps: finals.map((f) => f.step), signerSigned })) finalise.push({ step: final, label: STEP_LABEL[final] });
            }
            if (signerSigned.length) finalise.splice(0, finalise.length);
            const missing = (["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD"] as FinalStep[]).filter((f) => !finals.some((s) => s.step === f));
            waitingOn = missing.map((f) => STEP_LABEL[f]);
        }
    }
    const issuedSomething = [...issued.values()].some((q) => q > 0);
    const canManage = can(member, "settings:manage");

    return {
        id: req.id,
        number: req.number,
        kind: req.kind,
        state: req.state,
        workshop: req.workshop,
        location: req.location,
        requiredBy: req.requiredBy ? req.requiredBy.toISOString().slice(0, 10) : null,
        purpose: req.purpose,
        charge: req.chargeDocument
            ? { kind: "JOB", id: req.chargeDocument.id, label: [req.chargeDocument.jobNumber ?? req.chargeDocument.number, req.chargeDocument.vehicle?.plate].filter(Boolean).join(" · ") }
            : req.chargeVote
              ? { kind: "VOTE", id: req.chargeVote.id, label: `${req.chargeVote.code} · ${req.chargeVote.name}` }
              : null,
        requestedBy: fullName(req.requestedBy.user),
        createdAt: req.createdAt.toISOString(),
        value: req.value.toNumber(),
        lines: req.lines.map((l) => {
            const done = issued.get(l.id) ?? 0;
            const quantity = l.quantity.toNumber();
            return {
                id: l.id, productId: l.productId, itemCode: l.itemCode, description: l.description, quantity, unitCost: l.unitCost.toNumber(), note: l.note,
                issued: done, outstanding: outstanding({ quantity, issued: done }), onHand: l.product ? l.product.qtyOnHand.toNumber() : null, stocked: movesStock(l.product),
            };
        }),
        signoffs: req.signoffs.map((s) => ({ id: s.id, step: s.step, stepLabel: STEP_LABEL[s.step], decision: s.decision, name: s.name, role: s.role, payNumber: s.payNumber, comment: s.comment, at: s.at.toISOString() })),
        issues: req.issues.map((i) => ({
            id: i.id, at: i.at.toISOString(), issuedBy: fullName(i.issuedBy.user), receiverName: i.receiverName, receiverPayNumber: i.receiverPayNumber,
            lines: i.stockMovements.map((m) => ({ description: m.requisitionLine?.description ?? "", quantity: -m.quantity.toNumber() })),
        })),
        waitingOn,
        can: {
            edit: mine && editable(req.state) && can(member, "requisitions:raise"),
            submit: mine && req.state === "DRAFT" && can(member, "requisitions:raise"),
            discard: mine && req.state === "DRAFT" && !req.number,
            withdraw: mine && !!step,
            decide,
            issue: req.kind === "STORES" && req.state === "APPROVED" && can(member, "requisitions:issue"),
            finalise,
            cancel: cancelError({ state: req.state, isRequester: mine, canManage, issuedOrOrdered: issuedSomething }) === null && req.state !== "DRAFT",
        },
    };
}

/** The requisitions list: each row, and who it waits on. */
export async function requisitionList(db: TenantDb, filter: { show: "waiting" | "mine" | "issue" | "open" | "closed"; viewerId: string; waitingIds?: string[] }) {
    const where =
        filter.show === "mine"
            ? { requestedById: filter.viewerId }
            : filter.show === "issue"
              ? { kind: "STORES" as const, state: "APPROVED" as const }
              : filter.show === "open"
                ? { state: { in: [...OPEN_STATES, "AWAITING_FINALISE" as const] } }
                : filter.show === "closed"
                  ? { state: { in: ["CLOSED" as const, "REJECTED" as const, "CANCELLED" as const] } }
                  : { id: { in: filter.waitingIds ?? [] } };
    const rows = await db.requisition.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
            id: true, number: true, kind: true, state: true, value: true, createdAt: true,
            workshop: { select: { name: true } },
            requestedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            chargeDocument: { select: { jobNumber: true, number: true } },
            chargeVote: { select: { code: true } },
        },
    });
    return rows.map((r) => ({
        id: r.id, number: r.number, kind: r.kind, state: r.state, value: r.value.toNumber(), createdAt: r.createdAt,
        workshop: r.workshop?.name ?? null, requestedBy: fullName(r.requestedBy.user),
        charge: r.chargeDocument ? (r.chargeDocument.jobNumber ?? r.chargeDocument.number) : (r.chargeVote?.code ?? null),
    }));
}

/**
 * The requisitions waiting on this person: an approval step they may sign,
 * or a finalising box they hold. Read from the open ones, so it stays as
 * small as the queue.
 */
export async function waitingOnMe(db: TenantDb, tenant: Tenant, viewer: Viewer): Promise<string[]> {
    const open = await db.requisition.findMany({ where: { state: { in: ["AWAITING_FOREMAN", "AWAITING_HEAD", "AWAITING_OVER_LIMIT", "AWAITING_FINALISE"] } }, select: { id: true }, take: 200 });
    const ids: string[] = [];
    for (const r of open) {
        const view = await requisitionView(db, tenant, r.id, viewer);
        if (view && (view.can.decide || view.can.finalise.length)) ids.push(r.id);
    }
    return ids;
}
