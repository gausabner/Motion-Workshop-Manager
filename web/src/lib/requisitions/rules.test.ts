import { test } from "node:test";
import assert from "node:assert/strict";
import {
    cancelError,
    decisionError,
    editable,
    eligibleSigners,
    foremanStepRaisedByForeman,
    needsReapproval,
    requisitionValue,
    stateAfter,
    stepOf,
    stepsFor,
    submitError,
    unsignableStep,
    type Assignment,
} from "@/lib/requisitions/rules";

const WORKSHOP = "dept-workshop";
const PARKS = "dept-parks";
const assignments: Assignment[] = [
    { step: "FOREMAN", departmentId: WORKSHOP, membershipId: "foreman-a", deputy: false },
    { step: "FOREMAN", departmentId: WORKSHOP, membershipId: "foreman-b", deputy: true },
    { step: "DIVISIONAL_HEAD", departmentId: WORKSHOP, membershipId: "head", deputy: false },
    { step: "FOREMAN", departmentId: PARKS, membershipId: "parks-foreman", deputy: false },
    { step: "OVER_LIMIT", departmentId: null, membershipId: "procurement", deputy: false },
];

test("every requisition is signed by the foreman and the divisional head; above the limit, by one more", () => {
    assert.deepEqual(stepsFor(4_999.99, 5_000), ["FOREMAN", "DIVISIONAL_HEAD"]);
    assert.deepEqual(stepsFor(5_000, 5_000), ["FOREMAN", "DIVISIONAL_HEAD", "OVER_LIMIT"]);
    assert.deepEqual(stepsFor(1_000_000, null), ["FOREMAN", "DIVISIONAL_HEAD"], "no limit set, no extra step");
});

test("the value is the lines at their estimated rates, to the cent", () => {
    assert.equal(requisitionValue([{ quantity: 2, unitCost: 1_380 }, { quantity: 3, unitCost: 0.335 }]), 2_761.01);
    assert.equal(requisitionValue([]), 0);
});

test("a requisition is waiting on one named step at a time, and only a draft can be changed", () => {
    assert.equal(stepOf("AWAITING_FOREMAN"), "FOREMAN");
    assert.equal(stepOf("AWAITING_HEAD"), "DIVISIONAL_HEAD");
    assert.equal(stepOf("AWAITING_OVER_LIMIT"), "OVER_LIMIT");
    assert.equal(stepOf("APPROVED"), null);
    assert.equal(editable("DRAFT"), true);
    assert.equal(editable("AWAITING_FOREMAN"), false);
    assert.equal(editable("APPROVED"), false);
});

test("nobody signs their own requisition, and nobody signs two steps of one round", () => {
    const base = { departmentId: WORKSHOP, requesterId: "mechanic", signedThisRound: [], assignments };
    assert.deepEqual(eligibleSigners("FOREMAN", base).map((a) => a.membershipId), ["foreman-a", "foreman-b"]);
    assert.deepEqual(
        eligibleSigners("FOREMAN", { ...base, requesterId: "foreman-a" }).map((a) => a.membershipId),
        ["foreman-b"],
        "the deputy signs a foreman's own request",
    );
    // The head is also somebody's foreman somewhere, or covering: once they have signed one step they cannot sign the next.
    const headAlsoForeman = [...assignments, { step: "FOREMAN" as const, departmentId: WORKSHOP, membershipId: "head", deputy: true }];
    assert.deepEqual(
        eligibleSigners("DIVISIONAL_HEAD", { ...base, assignments: headAlsoForeman, signedThisRound: ["head"] }).map((a) => a.membershipId),
        [],
    );
});

test("a department's approvers sign only its own requisitions; the value limit is the council's", () => {
    const parks = { departmentId: PARKS, requesterId: "gardener", signedThisRound: [], assignments };
    assert.deepEqual(eligibleSigners("FOREMAN", parks).map((a) => a.membershipId), ["parks-foreman"]);
    assert.deepEqual(eligibleSigners("DIVISIONAL_HEAD", parks), [], "the workshop's head does not sign for Parks");
    assert.deepEqual(eligibleSigners("OVER_LIMIT", parks).map((a) => a.membershipId), ["procurement"]);
});

test("a section's only foreman asking for it is recorded as raised by the foreman, not skipped", () => {
    assert.equal(foremanStepRaisedByForeman({ departmentId: PARKS, requesterId: "parks-foreman", assignments }), true);
    assert.equal(foremanStepRaisedByForeman({ departmentId: WORKSHOP, requesterId: "foreman-a", assignments }), false, "the deputy can sign");
    assert.equal(foremanStepRaisedByForeman({ departmentId: WORKSHOP, requesterId: "mechanic", assignments }), false);
});

test("a requisition cannot be submitted into a queue nobody reads", () => {
    const input = { departmentId: PARKS, requesterId: "gardener", assignments };
    assert.match(unsignableStep(["FOREMAN", "DIVISIONAL_HEAD"], input)!, /divisional head step for this department/);
    assert.equal(unsignableStep(["FOREMAN", "DIVISIONAL_HEAD"], { ...input, departmentId: WORKSHOP }), null);
    assert.match(
        unsignableStep(["FOREMAN", "DIVISIONAL_HEAD", "OVER_LIMIT"], { departmentId: WORKSHOP, requesterId: "mechanic", assignments: assignments.filter((a) => a.step !== "OVER_LIMIT") })!,
        /the value limit/,
    );
});

test("a draft says what is missing before it can be submitted", () => {
    const ok = { state: "DRAFT" as const, lines: [{ description: "Safety boots, size 11", quantity: 1 }], departmentId: WORKSHOP, chargeDocumentId: null, chargeVoteId: "vote" };
    assert.equal(submitError(ok), null);
    assert.match(submitError({ ...ok, departmentId: null })!, /department/);
    assert.match(submitError({ ...ok, lines: [] })!, /at least one line/);
    assert.match(submitError({ ...ok, lines: [{ description: "Oil filter", quantity: 0 }] })!, /more than zero/);
    assert.match(submitError({ ...ok, chargeVoteId: null })!, /job card or to a vote\.$/);
    assert.match(submitError({ ...ok, chargeDocumentId: "job" })!, /not both/);
    assert.match(submitError({ ...ok, state: "AWAITING_FOREMAN" })!, /already been submitted/);
});

test("approving moves to the next step; returning goes back to draft; rejecting ends it", () => {
    const steps = stepsFor(10_000, 5_000);
    assert.equal(stateAfter("APPROVED", "FOREMAN", steps), "AWAITING_HEAD");
    assert.equal(stateAfter("APPROVED", "DIVISIONAL_HEAD", steps), "AWAITING_OVER_LIMIT");
    assert.equal(stateAfter("APPROVED", "OVER_LIMIT", steps), "APPROVED");
    assert.equal(stateAfter("APPROVED", "DIVISIONAL_HEAD", stepsFor(100, 5_000)), "APPROVED");
    assert.equal(stateAfter("RETURNED", "DIVISIONAL_HEAD", steps), "DRAFT");
    assert.equal(stateAfter("REJECTED", "FOREMAN", steps), "REJECTED");
});

test("returning and rejecting need a reason; approving does not", () => {
    assert.equal(decisionError("APPROVED", null), null);
    assert.match(decisionError("RETURNED", "  ")!, /what needs to change/);
    assert.match(decisionError("REJECTED", undefined)!, /reason/);
    assert.equal(decisionError("REJECTED", "Already issued on REQ-1003"), null);
});

test("an order dearer than approved by more than the tolerance has to be approved again", () => {
    assert.equal(needsReapproval(1_000, 1_100, 10), false);
    assert.equal(needsReapproval(1_000, 1_100.01, 10), true);
    assert.equal(needsReapproval(1_000, 950, 0), false);
});

test("before approval the requester may cancel; after it, only an owner or admin, and only while nothing has moved", () => {
    const base = { isRequester: true, canManage: false, issuedOrOrdered: false };
    assert.equal(cancelError({ ...base, state: "DRAFT" }), null);
    assert.equal(cancelError({ ...base, state: "AWAITING_HEAD" }), null);
    assert.match(cancelError({ ...base, isRequester: false, state: "AWAITING_HEAD" })!, /person who raised it/);
    assert.match(cancelError({ ...base, state: "APPROVED" })!, /only an owner or admin/);
    assert.equal(cancelError({ ...base, canManage: true, state: "APPROVED" }), null);
    assert.match(cancelError({ ...base, canManage: true, state: "APPROVED", issuedOrOrdered: true })!, /Close it instead/);
    assert.match(cancelError({ ...base, state: "CANCELLED" })!, /already cancelled/);
    assert.match(cancelError({ ...base, state: "REJECTED" })!, /closed/);
});
