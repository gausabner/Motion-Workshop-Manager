import "server-only";
import type { RequisitionKind, RequisitionState, RequisitionStep, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import type { ActionState } from "@/lib/forms";
import { can } from "@/lib/auth/permissions";
import { fullName } from "@/lib/format";
import { movesStock } from "@/lib/stock/rules";
import { requisitionSettings } from "@/lib/settings/schema";
import { candidatesFor, cancelError, editable, eligible, finaliseError, FITTER_DESIGNATIONS, requiredQuotes, STEP_LABEL, stepOf, stepsFor, type ApprovalStep, type FinalStep } from "@/lib/requisitions/rules";
import { arrivedLeft, issueDefault, outstanding, OPEN_STATES } from "@/lib/requisitions/stores-rules";
import { shortfall } from "@/lib/requisitions/purchase-rules";
import { buildLedger, either, stateLabel, type Ledger, type Progress } from "@/lib/requisitions/ledger";
import { signedThisRound, signingContext } from "@/lib/requisitions/service";
import { issuedByLine, movedByLine, orderedByLine, receivedByLine } from "@/lib/requisitions/counts";

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
    lines: {
        id: string; productId: string | null; itemCode: string | null; description: string; quantity: number; unitCost: number; note: string | null;
        issued: number; outstanding: number; onHand: number | null; stocked: boolean; issueDefault: number;
        /** On a stores requisition: moved to a purchase requisition. On a purchase requisition: ordered, and arrived. */
        moved: number; ordered: number; received: number;
    }[];
    ledger: Ledger;
    /** The stores requisition a purchase one was split from. */
    source: { id: string; number: string | null } | null;
    /** A purchase requisition's quotations, the council's rule for how many, and the suppliers asked. */
    quotes: { id: string; supplier: string; amount: number; reference: string | null; validUntil: string | null; chosen: boolean; obtainedBy: string; note: string | null; scan: { id: string; fileName: string } | null }[];
    quotesRequired: number;
    asked: { supplier: string; at: string; opened: number }[];
    can: {
        edit: boolean;
        submit: boolean;
        discard: boolean;
        withdraw: boolean;
        decide: { step: string } | null;
        issue: boolean;
        finalise: { step: FinalStep; label: string }[];
        cancel: boolean;
        /** Add, choose or remove quotations, and ask suppliers for them. */
        quotes: boolean;
        /** Stores: turn what the shelf cannot meet into a purchase requisition. */
        split: boolean;
        /** Stores: raise the purchase order from the chosen quotation. */
        order: boolean;
    };
};

/** What a requisition action answers with: the outcome, and the requisition as it now stands. */
export type RequisitionAnswer = ActionState & { view?: RequisitionView; emails?: { supplier: string; email: string; href: string }[] };

type Viewer = { id: string; group: string; extraPermissions: string[]; designations: string[] };

export async function requisitionView(db: TenantDb, tenant: Tenant, id: string, viewer: Viewer): Promise<RequisitionView | null> {
    const req = await db.requisition.findUnique({
        where: { id },
        select: {
            id: true, number: true, kind: true, state: true, location: true, requiredBy: true, purpose: true, value: true, createdAt: true,
            workshopId: true, chargeVoteId: true, chargeDocumentId: true, requestedById: true, submittedAt: true,
            source: { select: { id: true, number: true } },
            splits: { orderBy: { createdAt: "asc" }, select: { id: true, number: true, state: true, submittedAt: true, kind: true, lines: { select: { description: true, quantity: true } } } },
            quotes: {
                orderBy: { createdAt: "asc" },
                select: { id: true, amount: true, reference: true, validUntil: true, chosen: true, note: true, createdAt: true, supplier: { select: { companyName: true } }, obtainedBy: { select: { user: { select: { firstName: true, lastName: true } } } } },
            },
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
                    lines: { select: { quantity: true, requisitionLine: { select: { description: true } } } },
                },
            },
        },
    });
    if (!req) return null;
    const ids = req.lines.map((l) => l.id);
    const bought = req.kind === "PURCHASE";
    const [issued, moved, ordered, received] = await Promise.all([
        issuedByLine(db, ids),
        bought ? new Map<string, number>() : movedByLine(db, ids),
        bought ? orderedByLine(db, ids) : new Map<string, number>(),
        bought ? receivedByLine(db, ids) : new Map<string, { quantity: number; unitCost: number }>(),
    ]);
    const mine = req.requestedById === viewer.id;
    const member = viewer as Parameters<typeof can>[0];
    const settings = requisitionSettings(tenant.settings);
    const steps: ApprovalStep[] = stepsFor(req.value.toNumber(), settings.overLimitAt);

    const lines = req.lines.map((l) => {
        const done = issued.get(l.id) ?? 0;
        const quantity = l.quantity.toNumber();
        const line = {
            id: l.id, productId: l.productId, itemCode: l.itemCode, description: l.description, quantity, unitCost: l.unitCost.toNumber(), note: l.note,
            issued: done, moved: moved.get(l.id) ?? 0, ordered: ordered.get(l.id) ?? 0, received: received.get(l.id)?.quantity ?? 0,
            onHand: l.product ? l.product.qtyOnHand.toNumber() : null, stocked: movesStock(l.product),
        };
        return { ...line, outstanding: outstanding(line), issueDefault: issueDefault(line, req.kind) };
    });
    // A stores requisition waits on the shelf; a purchase one on the supplier, then on stores to hand over what came.
    const stockLeft = bought ? 0 : lines.filter((l) => l.stocked && l.outstanding > 0).length;
    const toBuy = bought ? [] : lines.filter((l) => !l.stocked && l.outstanding > 0);
    const issuedAny = lines.some((l) => l.issued > 0);
    const toHandOver = bought ? lines.filter((l) => Math.min(l.outstanding, arrivedLeft(l)) > 0).length : 0;
    const short = bought ? [] : shortfall(lines).map((s) => ({ description: lines.find((l) => l.id === s.lineId)!.description, quantity: s.quantity }));

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

    const stores = can(member, "requisitions:issue");
    const canIssue = req.state === "APPROVED" && (bought ? toHandOver > 0 : stockLeft > 0) && stores;
    const canSplit = !bought && req.state === "APPROVED" && short.length > 0 && stores;
    const orderedAny = lines.some((l) => l.ordered > 0);
    const chosen = req.quotes.find((q) => q.chosen) ?? null;
    const canOrder = bought && req.state === "APPROVED" && !!chosen && !orderedAny && stores;
    // Who handles a draft purchase requisition's quotations: the requester, stores, or a parts driver.
    const canQuote = bought && editable(req.state) && (mine || stores || viewer.designations.includes("PARTS_DRIVER"));
    const money = (n: number) => `${tenant.currency} ${n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const orders = bought && orderedAny
        ? await db.purchaseOrder.findMany({
              where: { lines: { some: { requisitionLineId: { in: ids } } }, state: { not: "CANCELLED" } },
              orderBy: { createdAt: "asc" },
              select: { id: true, number: true, state: true, createdAt: true, supplier: { select: { companyName: true } } },
          })
        : [];
    const asked = bought
        ? await db.shareLink.findMany({ where: { kind: "QUOTATION_REQUEST", targetId: id }, orderBy: { createdAt: "asc" }, select: { params: true, createdAt: true, openCount: true } })
        : [];
    const askedSuppliers = asked.length
        ? new Map((await db.supplier.findMany({ where: { id: { in: asked.map((a) => (a.params as Record<string, string>).supplierId).filter(Boolean) } }, select: { id: true, companyName: true } })).map((x) => [x.id, x.companyName]))
        : new Map<string, string>();
    const scans = req.quotes.length
        ? await db.attachment.findMany({ where: { ownerType: "RequisitionQuote", ownerId: { in: req.quotes.map((q) => q.id) } }, orderBy: { createdAt: "desc" }, select: { id: true, ownerId: true, fileName: true } })
        : [];
    const quotesRequired = requiredQuotes(chosen ? chosen.amount.toNumber() : req.value.toNumber(), settings.quoteBands);
    const splitLabel = (x: (typeof req.splits)[number]) => stateLabel({ state: x.state, number: x.number, kind: x.kind, submitted: !!x.submittedAt, issuedAny: false, stockLeft: 0, toBuy: 0 });
    const ledger = buildLedger({
        kind: req.kind,
        state: req.state,
        approvalSteps: steps,
        signoffs: req.signoffs.map((s) => ({ id: s.id, step: s.step, decision: s.decision, name: s.name, role: s.role, payNumber: s.payNumber, comment: s.comment, at: s.at.toISOString() })),
        issues: req.issues.map((i) => ({
            id: i.id, at: i.at.toISOString(),
            issuedBy: i.issuedByName ?? fullName(i.issuedBy.user), issuedByPayNumber: i.issuedByName ? i.issuedByPayNumber : i.issuedBy.payNumber,
            receiverName: i.receiverName, receiverPayNumber: i.receiverPayNumber,
            lines: i.lines.map((m) => ({ description: m.requisitionLine.description, quantity: m.quantity.toNumber() })),
        })),
        requestedBy: fullName(req.requestedBy.user),
        mine,
        submitter: mine || (bought && !!req.source && (stores || viewer.designations.includes("PARTS_DRIVER"))),
        holders,
        stockLeft,
        toBuy: toBuy.map((l) => ({ description: l.description, quantity: l.outstanding })),
        shortfall: short,
        splits: req.splits.map((x) => ({ id: x.id, number: x.number ?? "Draft", label: splitLabel(x), items: x.lines.map((l) => `${l.quantity.toNumber()} × ${l.description}`).join("; ") })),
        buying: bought
            ? {
                  quotes: { have: req.quotes.length, required: quotesRequired },
                  chosen: chosen ? { supplier: chosen.supplier.companyName, amount: money(chosen.amount.toNumber()), obtainedBy: fullName(chosen.obtainedBy.user), at: chosen.createdAt.toISOString() } : null,
                  orders: orders.map((o) => ({ id: o.id, number: o.number ?? "Order", supplier: o.supplier.companyName, sent: o.state !== "SUGGESTED", at: o.createdAt.toISOString() })),
                  arrived: { quantity: lines.reduce((sum, l) => sum + Math.min(l.received, l.quantity), 0), of: lines.reduce((sum, l) => sum + l.quantity, 0) },
                  toHandOver,
              }
            : undefined,
        can: { decide: !!decide, issue: canIssue, finalise: finalise.map((f) => f.step), split: canSplit, order: canOrder },
    });
    const canManage = can(member, "settings:manage");

    return {
        id: req.id,
        number: req.number,
        kind: req.kind,
        state: req.state,
        stateLabel: stateLabel({ state: req.state, number: req.number, kind: req.kind, submitted: !!req.submittedAt, issuedAny, stockLeft, toBuy: toBuy.length, ordered: orderedAny, receivedAny: lines.some((l) => l.received > 0), toHandOver }),
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
        source: req.source,
        quotes: req.quotes.map((q) => {
            const scan = scans.find((a) => a.ownerId === q.id);
            return {
                id: q.id, supplier: q.supplier.companyName, amount: q.amount.toNumber(), reference: q.reference, validUntil: q.validUntil ? q.validUntil.toISOString().slice(0, 10) : null,
                chosen: q.chosen, obtainedBy: fullName(q.obtainedBy.user), note: q.note, scan: scan ? { id: scan.id, fileName: scan.fileName } : null,
            };
        }),
        quotesRequired,
        asked: asked.map((a) => ({ supplier: askedSuppliers.get((a.params as Record<string, string>).supplierId) ?? "A supplier", at: a.createdAt.toISOString(), opened: a.openCount })),
        can: {
            edit: mine && editable(req.state) && can(member, "requisitions:raise"),
            // A split purchase requisition is sent on by whoever gathered its quotations.
            submit: req.state === "DRAFT" && ((mine && can(member, "requisitions:raise")) || (bought && !!req.source && (stores || viewer.designations.includes("PARTS_DRIVER")))),
            discard: mine && req.state === "DRAFT" && !req.number,
            withdraw: mine && !!step,
            decide,
            issue: canIssue,
            finalise,
            cancel: cancelError({ state: req.state, isRequester: mine, canManage, issuedOrOrdered: issuedAny || orderedAny }) === null && req.state !== "DRAFT",
            quotes: canQuote,
            split: canSplit,
            order: canOrder,
        },
    };
}

type ListLine = { id: string; quantity: { toNumber(): number }; description: string; product: Parameters<typeof movesStock>[0] };
type ListRow = { kind: "STORES" | "PURCHASE"; state: RequisitionState; number: string | null; submittedAt: Date | null; lines: ListLine[] };

/**
 * How far each requisition has got, read from the records: what stores has
 * issued, what was moved to a purchase, what is on order and has arrived.
 * Counted for a page of rows at once.
 */
async function progress(db: TenantDb, rows: ListRow[]) {
    const all = rows.flatMap((r) => r.lines.map((l) => l.id));
    const buying = rows.filter((r) => r.kind === "PURCHASE").flatMap((r) => r.lines.map((l) => l.id));
    const [issued, moved, ordered, received] = await Promise.all([issuedByLine(db, all), movedByLine(db, all), orderedByLine(db, buying), receivedByLine(db, buying)]);
    return (r: ListRow): Progress & { left: { description: string; left: number }[] } => {
        const bought = r.kind === "PURCHASE";
        const lines = r.lines.map((l) => {
            const line = { quantity: l.quantity.toNumber(), issued: issued.get(l.id) ?? 0, moved: bought ? 0 : (moved.get(l.id) ?? 0), received: received.get(l.id)?.quantity ?? 0 };
            return { description: l.description, ...line, ordered: ordered.get(l.id) ?? 0, left: outstanding(line), stocked: movesStock(l.product) };
        });
        return {
            kind: r.kind,
            submitted: !!r.submittedAt,
            issuedAny: lines.some((l) => l.issued > 0),
            stockLeft: bought ? 0 : lines.filter((l) => l.stocked && l.left > 0).length,
            toBuy: bought ? 0 : lines.filter((l) => !l.stocked && l.left > 0).length,
            ordered: lines.some((l) => l.ordered > 0),
            receivedAny: lines.some((l) => l.received > 0),
            toHandOver: bought ? lines.filter((l) => Math.min(l.left, arrivedLeft(l)) > 0).length : 0,
            left: lines.filter((l) => l.left > 0),
        };
    };
}

const LIST_LINES = { orderBy: { sortOrder: "asc" as const }, select: { id: true, quantity: true, description: true, product: { select: { type: true, isService: true, dontUpdateQty: true } } } };
const LIST_ROW = { kind: true, state: true, number: true, submittedAt: true, lines: LIST_LINES } as const;

export type ListShow = "waiting" | "mine" | "issue" | "quotes" | "open" | "closed";

/**
 * The requisitions list: each row, and where it is. Stores' own list is what
 * it has to hand over, oldest needed first, the way a counter works through a
 * queue; the parts driver's is the purchases still gathering quotations.
 */
export async function requisitionList(db: TenantDb, tenant: Tenant, filter: { show: ListShow; viewerId: string; waitingIds?: string[] }) {
    const where =
        filter.show === "mine"
            ? { requestedById: filter.viewerId }
            : filter.show === "issue"
              ? { state: "APPROVED" as const }
              : filter.show === "quotes"
                ? { kind: "PURCHASE" as const, state: "DRAFT" as const, number: { not: null } }
                : filter.show === "open"
                  ? { state: { in: [...OPEN_STATES, "AWAITING_FINALISE" as const] } }
                  : filter.show === "closed"
                    ? { state: { in: ["CLOSED" as const, "REJECTED" as const, "CANCELLED" as const] } }
                    : { id: { in: filter.waitingIds ?? [] } };
    const rows = await db.requisition.findMany({
        where,
        orderBy: filter.show === "issue" || filter.show === "quotes" ? [{ requiredBy: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] : { createdAt: "desc" },
        take: 200,
        select: {
            id: true, value: true, createdAt: true, requiredBy: true, ...LIST_ROW,
            workshop: { select: { name: true } },
            requestedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            chargeDocument: { select: { jobNumber: true, number: true } },
            chargeVote: { select: { code: true } },
            quotes: { select: { amount: true, chosen: true } },
        },
    });
    const of = await progress(db, rows);
    const bands = requisitionSettings(tenant.settings).quoteBands;
    return rows
        .map((r) => {
            const p = of(r);
            const chosen = r.quotes.find((q) => q.chosen);
            const label = stateLabel({ ...p, state: r.state, number: r.number });
            const gathering = r.kind === "PURCHASE" && r.state === "DRAFT";
            return {
                id: r.id, number: r.number, kind: r.kind, state: r.state, value: r.value.toNumber(), createdAt: r.createdAt,
                requiredBy: r.requiredBy ? r.requiredBy.toISOString().slice(0, 10) : null,
                workshop: r.workshop?.name ?? null, requestedBy: fullName(r.requestedBy.user),
                charge: r.chargeDocument ? (r.chargeDocument.jobNumber ?? r.chargeDocument.number) : (r.chargeVote?.code ?? null),
                // A purchase gathering quotations says how many it has of how many it needs.
                stateLabel: gathering ? `${label} · ${r.quotes.length} of ${requiredQuotes(chosen ? chosen.amount.toNumber() : r.value.toNumber(), bands)}` : label,
                handOver: p.stockLeft + (p.toHandOver ?? 0),
            };
        })
        // Stores' list is what it can hand over now: what waits only on a purchase, or on a supplier, is not.
        .filter((r) => filter.show !== "issue" || r.handOver > 0);
}

/** How many requisitions stores has something to hand over on, and how many purchases are gathering quotations, for the tabs' counts. */
export async function storesCounts(db: TenantDb): Promise<{ issue: number; quotes: number }> {
    const [approved, quotes] = await Promise.all([
        db.requisition.findMany({ where: { state: "APPROVED" }, take: 200, select: LIST_ROW }),
        db.requisition.count({ where: { kind: "PURCHASE", state: "DRAFT", number: { not: null } } }),
    ]);
    const of = await progress(db, approved);
    return { issue: approved.filter((r) => { const p = of(r); return p.stockLeft + (p.toHandOver ?? 0) > 0; }).length, quotes };
}

/**
 * A job card's requisitions, for its Parts panel: where each is, and, while
 * one is open, what the job is still waiting for, by name.
 */
export async function jobRequisitions(db: TenantDb, documentId: string) {
    const rows = await db.requisition.findMany({ where: { chargeDocumentId: documentId }, orderBy: { createdAt: "asc" }, select: { id: true, sourceRequisitionId: true, ...LIST_ROW } });
    const of = await progress(db, rows);
    return rows.map((r) => {
        const p = of(r);
        const open = (OPEN_STATES as RequisitionState[]).includes(r.state) || (r.state === "DRAFT" && !!r.sourceRequisitionId);
        return {
            id: r.id,
            number: r.number,
            state: r.state,
            stateLabel: stateLabel({ ...p, state: r.state, number: r.number }),
            items: r.lines.map((l) => `${l.quantity.toNumber()} × ${l.description}`).join(", "),
            waitingFor: open ? p.left.map((l) => `${l.left} × ${l.description}`).join(", ") || null : null,
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
