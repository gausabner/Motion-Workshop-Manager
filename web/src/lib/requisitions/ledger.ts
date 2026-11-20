import type { RequisitionKind, RequisitionState, RequisitionStep } from "@prisma/client";
import { STEP_LABEL, type ApprovalStep, type FinalStep } from "@/lib/requisitions/rules";

/**
 * The paper form's bottom row, as a ledger: every box the requisition will
 * need, in the form's order, from the start. A box is signed (with the name,
 * pay number and time it was signed with), due (somebody's turn now), or
 * still to come (with who will sign it). The screen is the record, so it shows
 * what is still to come as plainly as what has been done.
 *
 * Pure: the view gathers the facts, this lays them out, and the screen draws
 * it. That keeps the order of the boxes in one place, tested.
 */

export type LedgerSignoff = {
    id: string;
    step: RequisitionStep;
    decision: string;
    name: string;
    role: string;
    payNumber: string | null;
    comment: string | null;
    at: string;
};

export type LedgerIssue = {
    id: string;
    at: string;
    issuedBy: string;
    issuedByPayNumber: string | null;
    receiverName: string;
    receiverPayNumber: string | null;
    lines: { description: string; quantity: number }[];
};

/** What the person looking may do in a row: the row's own action, drawn inside it. */
export type LedgerAction = { kind: "decide" } | { kind: "issue" } | { kind: "finalise"; step: FinalStep } | { kind: "split" } | { kind: "order" };

/** A row that names another record: the purchase order, or the purchase requisition split off. */
export type LedgerLink = { kind: "order" | "requisition"; id: string; label: string };

/** A purchase requisition's buying, for its ledger: the quotation, the order, and what has arrived. Amounts come formatted. */
export type Buying = {
    quotes: { have: number; required: number };
    chosen: { supplier: string; amount: string; obtainedBy: string; at: string } | null;
    orders: { id: string; number: string; supplier: string; sent: boolean; at: string }[];
    arrived: { quantity: number; of: number };
    toHandOver: number;
};

export type LedgerRow = {
    key: string;
    box: string;
    status: "signed" | "due" | "later";
    name: string | null;
    /** A person's box carries a pay number, or "—" without one; a thing (a quotation, an order) has none to show. */
    payNumber?: string | null;
    /** The word the box was signed with: Approved, Signed, Received. */
    decision: string | null;
    comment: string | null;
    at: string | null;
    /** What was handed over, on a stores row. */
    items: string | null;
    /** For a box not yet signed: who signs it, or what it waits for. */
    waiting: string | null;
    action: LedgerAction | null;
    link?: LedgerLink;
};

export type LedgerGroup = { title: string; rows: LedgerRow[] };

export type Ledger = {
    groups: LedgerGroup[];
    /** Signatures from rounds before this one: a return, a withdrawal, and what had been signed before it. */
    earlier: LedgerRow[];
    /** Why it stopped, when it was returned, rejected or cancelled. */
    stopped: { title: string; comment: string | null } | null;
};

export const DECISION_WORD: Record<string, string> = {
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    RETURNED: "Returned",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    SIGNED: "Signed",
    WITNESSED: "Witnessed",
    RAISED_BY_FOREMAN: "Raised by the foreman",
};

const FINALS: FinalStep[] = ["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD", "FINAL_FITTER"];
const ENDED: RequisitionState[] = ["REJECTED", "CANCELLED"];
const SIGNED_AT_STEP = ["APPROVED", "RAISED_BY_FOREMAN", "REJECTED", "SIGNED", "WITNESSED"];

/** "Martha Iipinge", "Martha Iipinge or Frans van Wyk", "you or Frans van Wyk". */
export function either(names: string[]): string {
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

const blank = (key: string, box: string, patch: Partial<LedgerRow>): LedgerRow => ({
    key, box, status: "later", name: null, payNumber: undefined, decision: null, comment: null, at: null, items: null, waiting: null, action: null, ...patch,
});

const signedRow = (s: LedgerSignoff, box = STEP_LABEL[s.step]): LedgerRow =>
    blank(s.id, box, { status: "signed", name: s.name, payNumber: s.payNumber, decision: DECISION_WORD[s.decision] ?? s.decision, comment: s.comment, at: s.at });

export function buildLedger(input: {
    kind: RequisitionKind;
    state: RequisitionState;
    /** The approvals its value needs, in order. */
    approvalSteps: ApprovalStep[];
    signoffs: LedgerSignoff[];
    issues: LedgerIssue[];
    requestedBy: string;
    /** Whether the person looking raised it. */
    mine: boolean;
    /** Whether the person looking is the one who will submit it: the requester, or whoever gathers a split purchase's quotations. */
    submitter?: boolean;
    /** Who may sign each box, by name, "you" for the person looking. Empty: nobody is appointed. */
    holders: Partial<Record<RequisitionStep, string[]>>;
    /** What stores still has to hand over, and what has to be bought. */
    stockLeft: number;
    toBuy: { description: string; quantity: number }[];
    /** What stores cannot meet from the shelf: items it does not keep, and what the shelf is short of. */
    shortfall?: { description: string; quantity: number }[];
    /** Purchase requisitions split off this stores one. */
    splits?: { id: string; number: string; label: string; items: string }[];
    buying?: Buying;
    can: { decide: boolean; issue: boolean; finalise: FinalStep[]; split?: boolean; order?: boolean };
}): Ledger {
    const { state, signoffs } = input;
    const ended = ENDED.includes(state);
    const sorted = [...signoffs].sort((a, b) => a.at.localeCompare(b.at));

    // This round began at the last submission. A draft has no round open: what it holds was signed before it came back.
    const opened = state === "DRAFT" ? -1 : sorted.map((s) => s.decision).lastIndexOf("SUBMITTED");
    const current = opened < 0 ? [] : sorted.slice(opened);
    const earlier = (opened < 0 ? sorted : sorted.slice(0, opened)).map((s) => signedRow(s, s.role || STEP_LABEL[s.step]));
    const at = (step: RequisitionStep) => current.find((s) => s.step === step && SIGNED_AT_STEP.includes(s.decision));
    const who = (step: RequisitionStep, fallback: string) => {
        const names = input.holders[step] ?? [];
        return names.length ? either(names) : fallback;
    };

    // ── approval ──
    const approval: LedgerRow[] = [];
    const submitted = current.find((s) => s.decision === "SUBMITTED");
    if (submitted) approval.push(signedRow(submitted));
    else if (!ended) approval.push(blank("requested", STEP_LABEL.REQUESTED, { status: "due", waiting: input.submitter ?? input.mine ? "Signed when you submit it" : "Signed when it is submitted" }));
    for (const step of input.approvalSteps) {
        const signed = at(step);
        if (signed) approval.push(signedRow(signed));
        else if (ended) continue;
        else if (state === awaitingOf(step)) {
            approval.push(blank(step, STEP_LABEL[step], { status: "due", waiting: `Waiting on ${who(step, "nobody yet: an owner appoints one in Settings")}`, action: input.can.decide ? { kind: "decide" } : null }));
        } else if (state === "DRAFT" || isAwaiting(state)) {
            approval.push(blank(step, STEP_LABEL[step], { waiting: who(step, "Nobody appointed yet") }));
        }
    }
    // The paying division's fleet coordinator: never holds it up, so shown only once signed.
    for (const payer of current.filter((s) => s.step === "PAYER")) approval.push(signedRow(payer));
    const groups: LedgerGroup[] = [{ title: "Approval", rows: approval }];

    const items = (lines: { description: string; quantity: number }[]) => lines.map((l) => `${l.quantity} × ${l.description}`).join("; ");
    const bought = input.kind === "PURCHASE";

    // ── buying: the quotation approved, the order, and what has arrived ──
    if (bought && input.buying) {
        const b = input.buying;
        const buying: LedgerRow[] = [];
        if (b.chosen) buying.push(blank("quote", "Quotation chosen", { status: "signed", name: b.chosen.supplier, decision: b.chosen.amount, items: `Obtained by ${b.chosen.obtainedBy}`, at: b.chosen.at }));
        else if (!ended) buying.push(blank("quote", "Quotation chosen", { status: state === "DRAFT" ? "due" : "later", waiting: `${b.quotes.have} of ${b.quotes.required} ${b.quotes.required === 1 ? "quotation" : "quotations"} in, none chosen yet` }));
        for (const o of b.orders) {
            buying.push(blank(`order-${o.id}`, "Purchase order", { status: "signed", name: o.number, decision: `to ${o.supplier}`, items: o.sent ? null : "Not sent to the supplier yet", at: o.at, link: { kind: "order", id: o.id, label: `Open ${o.number}` } }));
        }
        if (!b.orders.length && !ended) {
            buying.push(state === "APPROVED"
                ? blank("order", "Purchase order", { status: "due", waiting: "Waiting on stores to order it", action: input.can.order ? { kind: "order" } : null })
                : blank("order", "Purchase order", { waiting: "Stores, once it is approved" }));
        }
        if (b.orders.length && !ended) {
            const all = b.arrived.quantity >= b.arrived.of;
            buying.push(blank("arrived", "Arrived", all
                ? { status: "signed", name: `All ${b.arrived.of} arrived`, decision: null }
                : { waiting: b.arrived.quantity ? `${b.arrived.quantity} of ${b.arrived.of} arrived` : `Waiting on ${b.orders[b.orders.length - 1].supplier}` }));
        }
        if (buying.length) groups.push({ title: "Buying", rows: buying });
    }

    if (input.kind === "STORES" || bought) {
        // ── stores: each handover is two boxes, the storeman's "verified by" and the receiver's ──
        const stores: LedgerRow[] = [];
        for (const i of input.issues) {
            stores.push(blank(`${i.id}-verified`, "Stores verified", { status: "signed", name: i.issuedBy, payNumber: i.issuedByPayNumber, decision: "Issued", at: i.at, items: items(i.lines) }));
            stores.push(blank(`${i.id}-received`, "Received", { status: "signed", name: i.receiverName, payNumber: i.receiverPayNumber, decision: "Received", at: i.at }));
        }
        if (!ended) {
            const handing = state === "APPROVED" && (bought ? (input.buying?.toHandOver ?? 0) > 0 : input.stockLeft > 0);
            if (handing) {
                stores.push(blank("issue", "Stores verified", {
                    status: "due",
                    waiting: bought ? "Arrived; waiting on stores to hand it over" : input.issues.length ? "Waiting on stores for the rest" : "Waiting on stores",
                    action: input.can.issue ? { kind: "issue" } : null,
                }));
            } else if (state === "DRAFT" || isAwaiting(state) || (bought && state === "APPROVED" && !input.issues.length)) {
                stores.push(blank("verified", "Stores verified", { waiting: bought ? "Stores, once it arrives" : "Stores, once it is approved" }));
                stores.push(blank("received", "Received", { waiting: "Whoever takes the parts, by name and pay number" }));
            }
            for (const split of input.splits ?? []) {
                stores.push(blank(`split-${split.id}`, "Bought instead", { waiting: `${split.number}: ${split.label}`, items: split.items, link: { kind: "requisition", id: split.id, label: `Open ${split.number}` } }));
            }
            const short = input.shortfall ?? [];
            if (!bought && state === "APPROVED" && short.length) {
                stores.push(blank("to-buy", "To be bought", {
                    status: input.can.split ? "due" : "later",
                    items: items(short),
                    waiting: input.can.split ? "Stores does not keep these, or has too few. Buy them on a purchase requisition." : "Not on the shelf. It stays open until stores buys it.",
                    action: input.can.split ? { kind: "split" } : null,
                }));
            } else if (!bought && input.toBuy.length && state !== "CLOSED") {
                stores.push(blank("to-buy", "To be bought", { items: items(input.toBuy), waiting: "Not a stock item. It stays open until it is bought." }));
            }
        }
        if (stores.length) groups.push({ title: "Stores", rows: stores });

        // ── finalising: three boxes always, the fitter's if they wish ──
        const finals: LedgerRow[] = [];
        for (const step of FINALS) {
            const signed = current.find((s) => s.step === step && s.decision === "SIGNED");
            const box = step === "FINAL_FITTER" ? "Fitted by (optional)" : STEP_LABEL[step];
            if (signed) finals.push(signedRow(signed, box));
            else if (ended || state === "CLOSED") continue;
            else {
                const due = state === "AWAITING_FINALISE";
                const action = due && input.can.finalise.includes(step) ? ({ kind: "finalise", step } as const) : null;
                const waiting =
                    step === "FINAL_FITTER"
                        ? "Whoever fitted the parts may sign"
                        : due
                          ? `Waiting on ${who(step, "nobody yet: an owner appoints one in Settings")}`
                          : who(step, "Nobody appointed yet");
                // The fitter's box is welcome, never awaited, so it never carries the marker.
                finals.push(blank(step, box, { status: due && step !== "FINAL_FITTER" ? "due" : "later", waiting, action }));
            }
        }
        if (finals.length) groups.push({ title: "Finalise", rows: finals });
    }

    // ── why it stopped ──
    let stopped: Ledger["stopped"] = null;
    const last = sorted[sorted.length - 1];
    const by = (s: LedgerSignoff) => `${s.name}${s.role && s.role !== s.name ? `, ${s.role}` : ""}`;
    if (state === "REJECTED") {
        const s = [...sorted].reverse().find((x) => x.decision === "REJECTED");
        if (s) stopped = { title: `Rejected by ${by(s)}`, comment: s.comment };
    } else if (state === "CANCELLED") {
        const s = [...sorted].reverse().find((x) => x.decision === "CANCELLED");
        if (s) stopped = { title: `Cancelled by ${s.name}`, comment: s.comment };
    } else if (state === "DRAFT" && last?.decision === "RETURNED") {
        stopped = last.step === "REQUESTED"
            ? { title: input.mine ? "You withdrew it to change it" : `Withdrawn by ${last.name} to change it`, comment: null }
            : { title: `Returned for changes by ${by(last)}`, comment: last.comment };
    }

    return { groups: groups.filter((g) => g.rows.length), earlier, stopped };
}

const AWAITING_STATE: Record<ApprovalStep, RequisitionState> = { FOREMAN: "AWAITING_FOREMAN", DIVISIONAL_HEAD: "AWAITING_HEAD", OVER_LIMIT: "AWAITING_OVER_LIMIT" };
const awaitingOf = (step: ApprovalStep) => AWAITING_STATE[step];
const isAwaiting = (state: RequisitionState) => (Object.values(AWAITING_STATE) as RequisitionState[]).includes(state);

/** What has happened on a requisition's lines, for its state in words. Optional fields are a purchase requisition's. */
export type Progress = {
    kind?: RequisitionKind;
    /** Ever submitted: a numbered draft that never was is a split purchase gathering quotations, not one returned. */
    submitted?: boolean;
    issuedAny: boolean;
    stockLeft: number;
    toBuy: number;
    ordered?: boolean;
    receivedAny?: boolean;
    /** Lines with something arrived and not yet handed over. */
    toHandOver?: number;
};

/**
 * Where a requisition is, in one phrase, the same on the list, the page and
 * the job card. An approved one says how far stores, or the supplier, has got.
 */
export function stateLabel(r: Progress & { state: RequisitionState; number: string | null }): string {
    const bought = `${r.toBuy} ${r.toBuy === 1 ? "line" : "lines"} to be bought`;
    switch (r.state) {
        case "DRAFT":
            if (!r.number) return "Draft";
            return r.kind === "PURCHASE" && r.submitted === false ? "Waiting for quotations" : "Returned for changes";
        case "AWAITING_FOREMAN": return "Waiting for the foreman";
        case "AWAITING_HEAD": return "Waiting for the divisional head";
        case "AWAITING_OVER_LIMIT": return "Waiting for the over-limit approver";
        case "APPROVED":
            if (r.kind === "PURCHASE") {
                if (!r.ordered) return "Approved, to be ordered";
                if ((r.toHandOver ?? 0) > 0) return r.issuedAny ? "Arrived, partly handed over" : "Arrived, to be handed over";
                return r.receivedAny ? "On order, part arrived" : "On order";
            }
            if (r.stockLeft === 0 && r.toBuy > 0) return `Approved, ${bought}`;
            return `${r.issuedAny ? "Approved, partly issued" : "Approved, to be issued"}${r.toBuy > 0 ? `; ${bought}` : ""}`;
        case "AWAITING_FINALISE": return "Issued, to be finalised";
        case "CLOSED": return "Closed";
        case "REJECTED": return "Rejected";
        case "CANCELLED": return "Cancelled";
    }
}
