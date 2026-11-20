import "server-only";
import type { RequisitionKind, RequisitionState, RequisitionStep, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import type { ActionState } from "@/lib/forms";
import { can } from "@/lib/auth/permissions";
import { fullName } from "@/lib/format";
import { movesStock } from "@/lib/stock/rules";
import { requisitionSettings } from "@/lib/settings/schema";
import { candidatesFor, cancelError, editable, eligible, finaliseError, FITTER_DESIGNATIONS, STEP_LABEL, stepOf, stepsFor, type ApprovalStep, type FinalStep } from "@/lib/requisitions/rules";
import { issueDefault, outstanding, OPEN_STATES } from "@/lib/requisitions/stores-rules";
import { buildLedger, either, stateLabel, type Ledger } from "@/lib/requisitions/ledger";
import { signedThisRound, signingContext } from "@/lib/requisitions/service";
import { issuedByLine } from "@/lib/requisitions/stores";

/**
 * A requisition as its screen shows it, and what the person looking may do
 * with it now. Plain values only, so it crosses to the client unchanged and
 * every action can answer with a fresh one.
 */

/** The bare state names, for filters and counts. The screens say where a requisition is with `stateLabel`, which knows what stores has done. */
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
const REQUIRED_FINALS = ["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD"] as const satisfies readonly FinalStep[];
const THE: Record<string, string> = { FINAL_FOREMAN: "the foreman", FINAL_FLEET_COORDINATOR: "the fleet coordinator", FINAL_DIVISIONAL_HEAD: "the divisional head" };

export type RequisitionView = {
    id: string;
    number: string | null;
    kind: RequisitionKind;
    state: RequisitionState;
    /** Where it is, in words: "Approved, partly issued". */
    stateLabel: string;
    /** Who or what it waits on now, in words, or null when nobody. */
    waiting: string | null;
    workshop: { id: string; name: string } | null;
    location: string | null;
    requiredBy: string | null;
    purpose: string | null;
    charge: { kind: "JOB"; id: string; label: string } | { kind: "VOTE"; id: string; label: string } | null;
    requestedBy: string;
    /** The membership that raised it: stores hands the parts to them unless told otherwise. */
    requesterId: string;
    createdAt: string;
    value: number;
    /** The council's value limit above which the over-limit approver signs too, or null when it has none. */
    overLimitAt: number | null;
    lines: { id: string; productId: string | null; itemCode: string | null; description: string; quantity: number; unitCost: number; note: string | null; issued: number; outstanding: number; onHand: number | null; stocked: boolean; issueDefault: number }[];
    ledger: Ledger;
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
            issues: {
                orderBy: { at: "asc" },
                select: {
                    id: true, at: true, receiverName: true, receiverPayNumber: true, issuedByName: true, issuedByPayNumber: true,
                    issuedBy: { select: { payNumber: true, user: { select: { firstName: true, lastName: true } } } },
                    stockMovements: { select: { quantity: true, requisitionLine: { select: { description: true } } } },
                },
            },
        },
    });
    if (!req) return null;
    const issued = await issuedByLine(db, req.lines.map((l) => l.id));
    const mine = req.requestedById === viewer.id;
    const member = viewer as Parameters<typeof can>[0];
    const settings = requisitionSettings(tenant.settings);
    const steps: ApprovalStep[] = stepsFor(req.value.toNumber(), settings.overLimitAt);

    const lines = req.lines.map((l) => {
        const done = issued.get(l.id) ?? 0;
        const quantity = l.quantity.toNumber();
        const line = {
            id: l.id, productId: l.productId, itemCode: l.itemCode, description: l.description, quantity, unitCost: l.unitCost.toNumber(), note: l.note,
            issued: done, outstanding: outstanding({ quantity, issued: done }), onHand: l.product ? l.product.qtyOnHand.toNumber() : null, stocked: movesStock(l.product),
        };
        return { ...line, issueDefault: issueDefault(line) };
    });
    const stockLeft = lines.filter((l) => l.stocked && l.outstanding > 0).length;
    const toBuy = lines.filter((l) => !l.stocked && l.outstanding > 0);
    const issuedAny = lines.some((l) => l.issued > 0);

    // Who holds each box: the approvals its value needs, and the finalising ones. "you" for the person looking.
    const holders: Partial<Record<RequisitionStep, string[]>> = {};
    const step = stepOf(req.state);
    let decide: RequisitionView["can"]["decide"] = null;
    const finalise: RequisitionView["can"]["finalise"] = [];
    const finals = req.signoffs.filter((s) => (FINAL_STEPS as string[]).includes(s.step));
    if (req.workshopId || req.chargeVoteId) {
        const { scope, authorities, units } = await signingContext(db, req);
        const signed = step ? await signedThisRound(db, id) : [];
        const ids = new Map<RequisitionStep, string[]>();
        for (const s of steps) ids.set(s, eligible(candidatesFor(s, scope, authorities, units), { requesterId: req.requestedById, signedThisRound: signed }).map((c) => c.membershipId));
        for (const f of REQUIRED_FINALS) ids.set(f, candidatesFor(f, scope, authorities, units).map((c) => c.membershipId));
        const people = await db.membership.findMany({ where: { id: { in: [...new Set([...ids.values()].flat())] } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } });
        const name = new Map(people.map((p) => [p.id, fullName(p.user)]));
        for (const [s, list] of ids) holders[s] = [...new Set(list)].map((m) => (m === viewer.id ? "you" : (name.get(m) ?? ""))).filter(Boolean).sort((a, b) => (a === "you" ? -1 : b === "you" ? 1 : a.localeCompare(b)));
        if (step && (ids.get(step) ?? []).includes(viewer.id)) decide = { step: STEP_LABEL[step] };

        if (req.state === "AWAITING_FINALISE") {
            const signerSigned = finals.filter((f) => f.membershipId === viewer.id).map((f) => f.step as FinalStep);
            for (const final of FINAL_STEPS) {
                const holds = final === "FINAL_FITTER" ? viewer.designations.some((d) => (FITTER_DESIGNATIONS as string[]).includes(d)) : (ids.get(final) ?? []).includes(viewer.id);
                // Nobody signs two boxes of the finalisation; the rule says so, and the screen offers only what it allows.
                if (holds && !finaliseError({ state: req.state, step: final, signedSteps: finals.map((f) => f.step), signerSigned })) finalise.push({ step: final, label: STEP_LABEL[final] });
            }
            if (signerSigned.length) finalise.splice(0, finalise.length);
        }
    }

    // What it waits on, in a phrase for the header.
    let waiting: string | null = null;
    if (step) waiting = `Waiting on ${either(holders[step] ?? []) || "nobody yet: an owner appoints one in Settings"}`;
    // Approved with only a purchase left: the state already says so.
    else if (req.state === "APPROVED") waiting = stockLeft > 0 ? "Waiting on stores" : null;
    else if (req.state === "AWAITING_FINALISE") {
        const missing = REQUIRED_FINALS.filter((f) => !finals.some((s) => s.step === f)).map((f) => THE[f]);
        if (missing.length) waiting = `Waiting on ${missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`} to sign`;
    }

    const canIssue = req.kind === "STORES" && req.state === "APPROVED" && stockLeft > 0 && can(member, "requisitions:issue");
    const ledger = buildLedger({
        kind: req.kind,
        state: req.state,
        approvalSteps: steps,
        signoffs: req.signoffs.map((s) => ({ id: s.id, step: s.step, decision: s.decision, name: s.name, role: s.role, payNumber: s.payNumber, comment: s.comment, at: s.at.toISOString() })),
        issues: req.issues.map((i) => ({
            id: i.id, at: i.at.toISOString(),
            issuedBy: i.issuedByName ?? fullName(i.issuedBy.user), issuedByPayNumber: i.issuedByName ? i.issuedByPayNumber : i.issuedBy.payNumber,
            receiverName: i.receiverName, receiverPayNumber: i.receiverPayNumber,
            lines: i.stockMovements.map((m) => ({ description: m.requisitionLine?.description ?? "", quantity: -m.quantity.toNumber() })),
        })),
        requestedBy: fullName(req.requestedBy.user),
        mine,
        holders,
        stockLeft,
        toBuy: toBuy.map((l) => ({ description: l.description, quantity: l.outstanding })),
        can: { decide: !!decide, issue: canIssue, finalise: finalise.map((f) => f.step) },
    });
    const canManage = can(member, "settings:manage");

    return {
        id: req.id,
        number: req.number,
        kind: req.kind,
        state: req.state,
        stateLabel: stateLabel({ state: req.state, number: req.number, issuedAny, stockLeft, toBuy: toBuy.length }),
        waiting,
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
        requesterId: req.requestedById,
        createdAt: req.createdAt.toISOString(),
        value: req.value.toNumber(),
        overLimitAt: settings.overLimitAt,
        lines,
        ledger,
        can: {
            edit: mine && editable(req.state) && can(member, "requisitions:raise"),
            submit: mine && req.state === "DRAFT" && can(member, "requisitions:raise"),
            discard: mine && req.state === "DRAFT" && !req.number,
            withdraw: mine && !!step,
            decide,
            issue: canIssue,
            finalise,
            cancel: cancelError({ state: req.state, isRequester: mine, canManage, issuedOrOrdered: issuedAny }) === null && req.state !== "DRAFT",
        },
    };
}

type ListLine = { id: string; quantity: { toNumber(): number }; description: string; product: Parameters<typeof movesStock>[0] };

/** What stores has done on each requisition, read from the movements: issued anything, stock still to hand over, lines to be bought. */
async function progress(db: TenantDb, rows: { lines: ListLine[] }[]) {
    const issued = await issuedByLine(db, rows.flatMap((r) => r.lines.map((l) => l.id)));
    return (r: { lines: ListLine[] }) => {
        const lines = r.lines.map((l) => {
            const done = issued.get(l.id) ?? 0;
            return { description: l.description, issued: done, left: outstanding({ quantity: l.quantity.toNumber(), issued: done }), stocked: movesStock(l.product) };
        });
        return {
            issuedAny: lines.some((l) => l.issued > 0),
            stockLeft: lines.filter((l) => l.stocked && l.left > 0).length,
            toBuy: lines.filter((l) => !l.stocked && l.left > 0),
            left: lines.filter((l) => l.left > 0),
        };
    };
}

const LIST_LINES = { orderBy: { sortOrder: "asc" as const }, select: { id: true, quantity: true, description: true, product: { select: { type: true, isService: true, dontUpdateQty: true } } } };

/**
 * The requisitions list: each row, and where it is. Stores' own list is the
 * ones with something on the shelf to hand over, oldest needed first, the way
 * a counter works through a queue.
 */
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
        orderBy: filter.show === "issue" ? [{ requiredBy: { sort: "asc", nulls: "last" } }, { submittedAt: "asc" }] : { createdAt: "desc" },
        take: 200,
        select: {
            id: true, number: true, kind: true, state: true, value: true, createdAt: true, requiredBy: true,
            workshop: { select: { name: true } },
            requestedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            chargeDocument: { select: { jobNumber: true, number: true } },
            chargeVote: { select: { code: true } },
            lines: LIST_LINES,
        },
    });
    const of = await progress(db, rows);
    return rows
        .map((r) => {
            const p = of(r);
            return {
                id: r.id, number: r.number, kind: r.kind, state: r.state, value: r.value.toNumber(), createdAt: r.createdAt,
                requiredBy: r.requiredBy ? r.requiredBy.toISOString().slice(0, 10) : null,
                workshop: r.workshop?.name ?? null, requestedBy: fullName(r.requestedBy.user),
                charge: r.chargeDocument ? (r.chargeDocument.jobNumber ?? r.chargeDocument.number) : (r.chargeVote?.code ?? null),
                stateLabel: stateLabel({ state: r.state, number: r.number, ...p, toBuy: p.toBuy.length }),
                stockLeft: p.stockLeft,
            };
        })
        // What waits only on a purchase is not stores' to issue.
        .filter((r) => filter.show !== "issue" || r.stockLeft > 0);
}

/** How many requisitions stores has something to hand over on, for the tab's count. */
export async function toIssueCount(db: TenantDb): Promise<number> {
    const rows = await db.requisition.findMany({ where: { kind: "STORES", state: "APPROVED" }, take: 200, select: { lines: LIST_LINES } });
    const of = await progress(db, rows);
    return rows.filter((r) => of(r).stockLeft > 0).length;
}

/**
 * A job card's requisitions, for its Parts panel: where each is, and, while
 * one is open, what the job is still waiting for, by name.
 */
export async function jobRequisitions(db: TenantDb, documentId: string) {
    const rows = await db.requisition.findMany({ where: { chargeDocumentId: documentId }, orderBy: { createdAt: "asc" }, select: { id: true, number: true, state: true, lines: LIST_LINES } });
    const of = await progress(db, rows);
    return rows.map((r) => {
        const p = of(r);
        const open = (OPEN_STATES as RequisitionState[]).includes(r.state);
        return {
            id: r.id,
            number: r.number,
            state: r.state,
            stateLabel: stateLabel({ state: r.state, number: r.number, ...p, toBuy: p.toBuy.length }),
            items: r.lines.map((l) => `${l.quantity.toNumber()} × ${l.description}`).join(", "),
            waitingFor: open ? p.left.map((l) => `${l.left} × ${l.description}`).join(", ") : null,
        };
    });
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
