import { test } from "node:test";
import assert from "node:assert/strict";
import {
    approvalValue,
    cancelError,
    candidatesFor,
    decisionError,
    editable,
    eligible,
    finaliseError,
    finalised,
    foremanStepRaisedByForeman,
    holders,
    lineage,
    needsReapproval,
    payerError,
    payingUnit,
    quoteError,
    requiredQuotes,
    requisitionValue,
    stateAfter,
    stepOf,
    stepsFor,
    submitError,
    unsignableStep,
    type Authority,
    type Unit,
} from "@/lib/requisitions/rules";

// The owner's council: Divisions with Departments under them.
const units: Unit[] = [
    { id: "technical", parentId: null },
    { id: "fleet", parentId: "technical" },
    { id: "community", parentId: null },
    { id: "parks", parentId: "community" },
];
const authorities: Authority[] = [
    { kind: "FOREMAN", workshopId: "heavy", orgUnitId: null, membershipId: "foreman-a", deputy: false },
    { kind: "FOREMAN", workshopId: "heavy", orgUnitId: null, membershipId: "foreman-b", deputy: true },
    { kind: "FOREMAN", workshopId: "tyres", orgUnitId: null, membershipId: "tyre-foreman", deputy: false },
    { kind: "DIVISION_HEAD", workshopId: null, orgUnitId: "technical", membershipId: "head", deputy: false },
    { kind: "FLEET_COORDINATOR", workshopId: null, orgUnitId: "technical", membershipId: "fleet-tech", deputy: false },
    { kind: "FLEET_COORDINATOR", workshopId: null, orgUnitId: "community", membershipId: "fleet-parks", deputy: false },
    { kind: "OVER_LIMIT", workshopId: null, orgUnitId: null, membershipId: "procurement", deputy: false },
];
const heavy = { workshopId: "heavy", workshopUnitId: "fleet", payingUnitId: "fleet" };
const ids = (c: { membershipId: string }[]) => c.map((x) => x.membershipId);

test("a unit's lineage runs from itself up to the top of the tree", () => {
    assert.deepEqual(lineage("parks", units), ["parks", "community"]);
    assert.deepEqual(lineage("technical", units), ["technical"]);
    assert.deepEqual(lineage(null, units), []);
});

test("a division's head and fleet coordinator sign for everything under it; the nearest appointment wins", () => {
    assert.deepEqual(ids(holders("DIVISION_HEAD", { orgUnitId: "fleet" }, authorities, units)), ["head"]);
    assert.deepEqual(ids(holders("FLEET_COORDINATOR", { orgUnitId: "parks" }, authorities, units)), ["fleet-parks"]);
    const withOwnHead = [...authorities, { kind: "DIVISION_HEAD" as const, workshopId: null, orgUnitId: "fleet", membershipId: "fleet-head", deputy: false }];
    assert.deepEqual(ids(holders("DIVISION_HEAD", { orgUnitId: "fleet" }, withOwnHead, units)), ["fleet-head"], "a department's own head, not its division's");
    assert.deepEqual(ids(holders("DIVISION_HEAD", { orgUnitId: "parks" }, authorities, units)), [], "nobody heads Community Services");
});

test("each box on the form is held by the right people", () => {
    assert.deepEqual(ids(candidatesFor("FOREMAN", heavy, authorities, units)), ["foreman-a", "foreman-b"]);
    assert.deepEqual(ids(candidatesFor("DIVISIONAL_HEAD", heavy, authorities, units)), ["head"]);
    assert.deepEqual(ids(candidatesFor("OVER_LIMIT", heavy, authorities, units)), ["procurement"]);
    const parksPays = { ...heavy, payingUnitId: payingUnit({ voteUnitId: "parks", workshopUnitId: "fleet" }) };
    assert.deepEqual(ids(candidatesFor("PAYER", parksPays, authorities, units)), ["fleet-parks"], "the vote's division pays");
    assert.deepEqual(ids(candidatesFor("FINAL_FLEET_COORDINATOR", heavy, authorities, units)), ["fleet-tech"], "no vote: the workshop's own");
    assert.deepEqual(ids(candidatesFor("FINAL_DIVISIONAL_HEAD", parksPays, authorities, units)), ["head"], "the workshop's head finalises, whoever pays");
});

test("every requisition is approved by the foreman and the divisional head; above the limit, by one more", () => {
    assert.deepEqual(stepsFor(4_999.99, 5_000), ["FOREMAN", "DIVISIONAL_HEAD"]);
    assert.deepEqual(stepsFor(5_000, 5_000), ["FOREMAN", "DIVISIONAL_HEAD", "OVER_LIMIT"]);
    assert.deepEqual(stepsFor(1_000_000, null), ["FOREMAN", "DIVISIONAL_HEAD"]);
    assert.equal(stepOf("AWAITING_HEAD"), "DIVISIONAL_HEAD");
    assert.equal(stepOf("AWAITING_FINALISE"), null);
    assert.equal(editable("DRAFT"), true);
    assert.equal(editable("APPROVED"), false);
});

test("a stores requisition is valued at its lines; a purchase requisition at the quotation chosen", () => {
    assert.equal(requisitionValue([{ quantity: 2, unitCost: 1_380 }, { quantity: 3, unitCost: 0.335 }]), 2_761.01);
    assert.equal(approvalValue("STORES", 2_761.01, 3_000), 2_761.01);
    assert.equal(approvalValue("PURCHASE", 2_761.01, 3_045.5), 3_045.5);
    assert.equal(approvalValue("PURCHASE", 2_761.01, null), 2_761.01, "until one is chosen, the estimate");
});

test("nobody signs their own requisition, and nobody signs two approvals of one round", () => {
    const foremen = candidatesFor("FOREMAN", heavy, authorities, units);
    assert.deepEqual(ids(eligible(foremen, { requesterId: "mechanic", signedThisRound: [] })), ["foreman-a", "foreman-b"]);
    assert.deepEqual(ids(eligible(foremen, { requesterId: "foreman-a", signedThisRound: [] })), ["foreman-b"], "the deputy signs a foreman's own request");
    assert.deepEqual(ids(eligible(foremen, { requesterId: "mechanic", signedThisRound: ["foreman-a", "foreman-b"] })), []);
});

test("a workshop's only foreman asking for it is recorded as raised by the foreman, not skipped", () => {
    const tyre = candidatesFor("FOREMAN", { ...heavy, workshopId: "tyres" }, authorities, units);
    assert.equal(foremanStepRaisedByForeman(tyre, "tyre-foreman"), true);
    assert.equal(foremanStepRaisedByForeman(candidatesFor("FOREMAN", heavy, authorities, units), "foreman-a"), false, "the deputy can sign");
});

test("a requisition cannot be submitted into a queue nobody reads", () => {
    const at = (scope: typeof heavy) => ({
        FOREMAN: candidatesFor("FOREMAN", scope, authorities, units),
        DIVISIONAL_HEAD: candidatesFor("DIVISIONAL_HEAD", scope, authorities, units),
        OVER_LIMIT: candidatesFor("OVER_LIMIT", scope, authorities, units),
    });
    assert.equal(unsignableStep(["FOREMAN", "DIVISIONAL_HEAD"], at(heavy), "mechanic"), null);
    assert.match(unsignableStep(["FOREMAN"], at({ ...heavy, workshopId: "carwash" }), "mechanic")!, /foreman step for this workshop/);
    assert.match(unsignableStep(["FOREMAN", "DIVISIONAL_HEAD"], at({ ...heavy, workshopUnitId: "parks" }), "mechanic")!, /divisional head step/);
});

test("a draft says what is missing before it can be submitted", () => {
    const ok = { state: "DRAFT" as const, workshopId: "heavy", lines: [{ description: "Hydraulic pump, TLB", quantity: 1 }], chargeDocumentId: "job", chargeVoteId: null };
    assert.equal(submitError(ok), null);
    assert.match(submitError({ ...ok, workshopId: null })!, /workshop/);
    assert.match(submitError({ ...ok, lines: [] })!, /at least one line/);
    assert.match(submitError({ ...ok, lines: [{ description: "Pump", quantity: 0 }] })!, /more than zero/);
    assert.match(submitError({ ...ok, chargeDocumentId: null })!, /job card or to a vote\.$/);
    assert.match(submitError({ ...ok, chargeVoteId: "vote" })!, /not both/);
    // An item typed in by hand carries an estimate, or its value would slip under the council's limit.
    assert.match(submitError({ ...ok, lines: [{ description: "Output bearing, SKF 6310", quantity: 2, productId: null, unitCost: 0 }] })!, /estimated rate for “Output bearing, SKF 6310”/);
    assert.equal(submitError({ ...ok, lines: [{ description: "Output bearing, SKF 6310", quantity: 2, productId: null, unitCost: 1280 }] }), null);
    assert.equal(submitError({ ...ok, lines: [{ description: "Gear oil", quantity: 1, productId: "p1", unitCost: 0 }] }), null, "a stock item is priced by stores");
});

test("the council's quotation rule is read at the chosen quotation's value", () => {
    const bands = [{ from: 0, quotes: 1 }, { from: 10_000, quotes: 3 }];
    assert.equal(requiredQuotes(9_999.99, bands), 1);
    assert.equal(requiredQuotes(10_000, bands), 3);
    const q = (amount: number, chosen = false, validUntil: string | null = null) => ({ amount, chosen, validUntil });
    const today = "2026-11-19";
    assert.match(quoteError({ quotes: [], bands, today })!, /Attach the quotation/);
    assert.match(quoteError({ quotes: [q(12_000), q(12_500)], bands, today })!, /Choose the quotation/);
    assert.match(quoteError({ quotes: [q(12_000, true), q(12_500)], bands, today })!, /needs 3 quotations\. It has 2/);
    assert.equal(quoteError({ quotes: [q(12_000, true), q(12_500), q(13_100)], bands, today }), null);
    assert.equal(quoteError({ quotes: [q(4_200, true)], bands, today }), null, "below the band, one will do");
    assert.match(quoteError({ quotes: [q(4_200, true, "2026-11-18")], bands, today })!, /expired/);
});

test("approving moves to the next step; returning goes back to draft; rejecting ends it", () => {
    const steps = stepsFor(10_000, 5_000);
    assert.equal(stateAfter("APPROVED", "FOREMAN", steps), "AWAITING_HEAD");
    assert.equal(stateAfter("APPROVED", "DIVISIONAL_HEAD", steps), "AWAITING_OVER_LIMIT");
    assert.equal(stateAfter("APPROVED", "OVER_LIMIT", steps), "APPROVED");
    assert.equal(stateAfter("APPROVED", "OVER_LIMIT", stepsFor(100, 5_000)), "APPROVED", "the limit moved: this was the last approval");
    assert.equal(stateAfter("RETURNED", "DIVISIONAL_HEAD", steps), "DRAFT");
    assert.equal(stateAfter("REJECTED", "FOREMAN", steps), "REJECTED");
    assert.equal(decisionError("APPROVED", null), null);
    assert.match(decisionError("RETURNED", " ")!, /what needs to change/);
    assert.match(decisionError("REJECTED", undefined)!, /reason/);
});

test("an order dearer than approved by more than the tolerance has to be approved again", () => {
    assert.equal(needsReapproval(1_000, 1_100, 10), false);
    assert.equal(needsReapproval(1_000, 1_100.01, 10), true);
});

test("the paying division signs once, after the workshop has approved, and never holds it up", () => {
    assert.match(payerError("AWAITING_HEAD", false)!, /not approved it yet/);
    assert.equal(payerError("APPROVED", false), null);
    assert.equal(payerError("AWAITING_FINALISE", false), null);
    assert.match(payerError("APPROVED", true)!, /already signed/);
});

test("finalising needs the foreman, the fleet coordinator and the divisional head; the fitter may sign; nobody signs two boxes", () => {
    const base = { state: "AWAITING_FINALISE" as const, signedSteps: [] as never[], signerSigned: [] as never[] };
    assert.equal(finaliseError({ ...base, step: "FINAL_FOREMAN" }), null);
    assert.match(finaliseError({ ...base, state: "APPROVED", step: "FINAL_FOREMAN" })!, /not waiting to be finalised/);
    assert.match(finaliseError({ ...base, step: "FINAL_FOREMAN", signedSteps: ["FINAL_FOREMAN"] as never[] })!, /already been signed/);
    assert.match(finaliseError({ ...base, step: "FINAL_DIVISIONAL_HEAD", signerSigned: ["FINAL_FOREMAN"] as never[] })!, /already signed it as foreman/);
    assert.equal(finalised(["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR"]), false);
    assert.equal(finalised(["FINAL_FOREMAN", "FINAL_FLEET_COORDINATOR", "FINAL_DIVISIONAL_HEAD"]), true, "without the fitter");
});

test("before approval the requester may cancel; after it, only an owner or admin, and only while nothing has moved", () => {
    const base = { isRequester: true, canManage: false, issuedOrOrdered: false };
    assert.equal(cancelError({ ...base, state: "AWAITING_HEAD" }), null);
    assert.match(cancelError({ ...base, isRequester: false, state: "AWAITING_HEAD" })!, /person who raised it/);
    assert.match(cancelError({ ...base, state: "APPROVED" })!, /only an owner or admin/);
    assert.equal(cancelError({ ...base, canManage: true, state: "APPROVED" }), null);
    assert.match(cancelError({ ...base, canManage: true, state: "AWAITING_FINALISE", issuedOrOrdered: true })!, /Finalise it instead/);
    assert.match(cancelError({ ...base, state: "CLOSED" })!, /closed/);
});
