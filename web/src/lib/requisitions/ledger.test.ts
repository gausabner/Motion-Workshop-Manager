import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLedger, either, stateLabel, type LedgerSignoff } from "@/lib/requisitions/ledger";

/** The form's bottom row: every box in order from the start, the one due now marked, and what came before a return kept apart. */

const sign = (n: number, step: LedgerSignoff["step"], decision: string, name: string, extra: Partial<LedgerSignoff> = {}): LedgerSignoff => ({
    id: `s${n}`, step, decision, name, role: step, payNumber: `PN-${n}`, comment: null, at: `2026-11-20T10:0${n}:00.000Z`, ...extra,
});
const base = {
    kind: "STORES" as const,
    approvalSteps: ["FOREMAN", "DIVISIONAL_HEAD"] as ("FOREMAN" | "DIVISIONAL_HEAD")[],
    issues: [],
    requestedBy: "Tobias Kandjii",
    mine: false,
    holders: { FOREMAN: ["Martha Iipinge"], DIVISIONAL_HEAD: ["Elago Mwandingi"], FINAL_FOREMAN: ["you", "Martha Iipinge"], FINAL_FLEET_COORDINATOR: ["Ndapewa Shikongo"], FINAL_DIVISIONAL_HEAD: ["Elago Mwandingi"] },
    stockLeft: 1,
    toBuy: [],
    can: { decide: false, issue: false, finalise: [] },
};
const rows = (l: ReturnType<typeof buildLedger>) => l.groups.map((g) => [g.title, g.rows.map((r) => `${r.box}:${r.status}`)]);

test("a submitted requisition shows every box to come, and marks the foreman's as due", () => {
    const l = buildLedger({ ...base, state: "AWAITING_FOREMAN", signoffs: [sign(1, "REQUESTED", "SUBMITTED", "Tobias Kandjii")], can: { ...base.can, decide: true } });
    assert.deepEqual(rows(l), [
        ["Approval", ["Requisitioned by:signed", "Foreman:due", "Divisional Head:later"]],
        ["Stores", ["Stores verified:later", "Received:later"]],
        ["Finalise", ["Foreman:later", "Fleet Coordinator:later", "Divisional Head:later", "Fitted by (optional):later"]],
    ]);
    const foreman = l.groups[0].rows[1];
    assert.equal(foreman.waiting, "Waiting on Martha Iipinge");
    assert.deepEqual(foreman.action, { kind: "decide" });
    assert.equal(l.groups[0].rows[2].waiting, "Elago Mwandingi", "who will sign is named before their turn");
    assert.equal(l.stopped, null);
});

test("handovers are two boxes each, the rest still waits on stores, and a bought line is said plainly", () => {
    const l = buildLedger({
        ...base,
        state: "APPROVED",
        signoffs: [sign(1, "REQUESTED", "SUBMITTED", "Tobias Kandjii"), sign(2, "FOREMAN", "APPROVED", "Frans van Wyk"), sign(3, "DIVISIONAL_HEAD", "APPROVED", "Elago Mwandingi")],
        issues: [{ id: "i1", at: "2026-11-20T11:00:00.000Z", issuedBy: "Hilma Nakale", issuedByPayNumber: "PN-16034", receiverName: "Tobias Kandjii", receiverPayNumber: "PN-15561", lines: [{ description: "Gear oil", quantity: 1 }] }],
        toBuy: [{ description: "Output bearing", quantity: 2 }],
        can: { ...base.can, issue: true },
    });
    const stores = l.groups.find((g) => g.title === "Stores")!.rows;
    assert.deepEqual(stores.map((r) => `${r.box}:${r.status}`), ["Stores verified:signed", "Received:signed", "Stores verified:due", "To be bought:later"]);
    assert.equal(stores[0].payNumber, "PN-16034", "the storeman's verification carries a pay number like every box");
    assert.equal(stores[0].items, "1 × Gear oil");
    assert.deepEqual(stores[2].action, { kind: "issue" });
    assert.equal(stores[3].items, "2 × Output bearing");
});

test("finalising: the three boxes are due, the fitter's is welcome but never awaited, and the signer signs in their own row", () => {
    const l = buildLedger({
        ...base,
        state: "AWAITING_FINALISE",
        stockLeft: 0,
        signoffs: [sign(1, "REQUESTED", "SUBMITTED", "Tobias Kandjii"), sign(2, "FOREMAN", "APPROVED", "Frans van Wyk"), sign(3, "DIVISIONAL_HEAD", "APPROVED", "Elago Mwandingi"), sign(4, "FINAL_FLEET_COORDINATOR", "SIGNED", "Ndapewa Shikongo")],
        can: { ...base.can, finalise: ["FINAL_FOREMAN"] },
    });
    const finals = l.groups.find((g) => g.title === "Finalise")!.rows;
    assert.deepEqual(finals.map((r) => `${r.box}:${r.status}`), ["Foreman:due", "Fleet Coordinator:signed", "Divisional Head:due", "Fitted by (optional):later"]);
    assert.equal(finals[0].waiting, "Waiting on you or Martha Iipinge");
    assert.deepEqual(finals[0].action, { kind: "finalise", step: "FINAL_FOREMAN" });
    assert.equal(finals[2].action, null, "nobody is offered a box they do not hold");
});

test("a returned requisition keeps its first round apart and says who sent it back and why", () => {
    const l = buildLedger({
        ...base,
        state: "DRAFT",
        mine: true,
        signoffs: [sign(1, "REQUESTED", "SUBMITTED", "Tobias Kandjii"), sign(2, "FOREMAN", "RETURNED", "Martha Iipinge", { role: "Foreman", comment: "Add the seal kit" })],
    });
    assert.equal(l.earlier.length, 2);
    assert.deepEqual(l.stopped, { title: "Returned for changes by Martha Iipinge, Foreman", comment: "Add the seal kit" });
    assert.equal(l.groups[0].rows[0].status, "due");
    assert.equal(l.groups[0].rows[0].waiting, "Signed when you submit it");
});

test("a rejected one shows only what was signed, and the reason", () => {
    const l = buildLedger({
        ...base,
        state: "REJECTED",
        signoffs: [sign(1, "REQUESTED", "SUBMITTED", "Tobias Kandjii"), sign(2, "FOREMAN", "REJECTED", "Martha Iipinge", { role: "Foreman", comment: "Replaced in August" })],
    });
    assert.deepEqual(rows(l), [["Approval", ["Requisitioned by:signed", "Foreman:signed"]]]);
    assert.deepEqual(l.stopped, { title: "Rejected by Martha Iipinge, Foreman", comment: "Replaced in August" });
});

test("where it is, in one phrase, the same everywhere", () => {
    const at = (p: Partial<Parameters<typeof stateLabel>[0]>) => stateLabel({ state: "APPROVED", number: "REQ-1", issuedAny: false, stockLeft: 1, toBuy: 0, ...p });
    assert.equal(at({}), "Approved, to be issued");
    assert.equal(at({ issuedAny: true }), "Approved, partly issued");
    assert.equal(at({ issuedAny: true, toBuy: 1 }), "Approved, partly issued; 1 line to be bought");
    assert.equal(at({ issuedAny: true, stockLeft: 0, toBuy: 2 }), "Approved, 2 lines to be bought");
    assert.equal(at({ state: "DRAFT" }), "Returned for changes");
    assert.equal(at({ state: "DRAFT", number: null }), "Draft");
    assert.equal(either(["you", "Martha Iipinge", "Frans van Wyk"]), "you, Martha Iipinge or Frans van Wyk");
});
