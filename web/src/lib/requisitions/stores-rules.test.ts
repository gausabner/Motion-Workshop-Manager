import { test } from "node:test";
import assert from "node:assert/strict";
import { fullyIssued, issueError, outstanding, partsStatus, type IssueLine } from "@/lib/requisitions/stores-rules";

/** What may leave the shelf against a requisition, and what the job card says while it waits. */

const pads: IssueLine = { id: "a", description: "Brake pads", quantity: 3, issued: 1, stocked: true };
const hose: IssueLine = { id: "b", description: "Hydraulic hose, made to measure", quantity: 1, issued: 0, stocked: false };
const base = { state: "APPROVED" as const, kind: "STORES" as const, lines: [pads, hose], issuerId: "store", receiver: { membershipId: "mech", name: "Tobias Kandjii" } };

test("what a line still needs is what it asked for less what has been issued", () => {
    assert.equal(outstanding(pads), 2);
    assert.equal(outstanding({ quantity: 1.5, issued: 1.25 }), 0.25);
    assert.equal(outstanding({ quantity: 2, issued: 3 }), 0, "never below nothing");
    assert.equal(fullyIssued([pads]), false);
    assert.equal(fullyIssued([{ quantity: 3, issued: 3 }]), true);
    assert.equal(fullyIssued([]), false, "an empty requisition has not been met");
});

test("stores issues only what is approved, still needed, and in stock, to somebody else", () => {
    assert.equal(issueError({ ...base, issue: [{ lineId: "a", quantity: 2 }] }), null);
    assert.match(issueError({ ...base, state: "AWAITING_HEAD", issue: [{ lineId: "a", quantity: 1 }] }) ?? "", /not been approved/);
    assert.match(issueError({ ...base, kind: "PURCHASE", issue: [{ lineId: "a", quantity: 1 }] }) ?? "", /Only a stores requisition/);
    assert.match(issueError({ ...base, issue: [{ lineId: "a", quantity: 3 }] }) ?? "", /Only 2 of “Brake pads” are still/);
    assert.match(issueError({ ...base, issue: [{ lineId: "b", quantity: 1 }] }) ?? "", /not a stock item/);
    assert.match(issueError({ ...base, issue: [{ lineId: "a", quantity: 0 }] }) ?? "", /at least one item/);
    assert.match(issueError({ ...base, receiver: { membershipId: "store", name: "Hilma Nakale" }, issue: [{ lineId: "a", quantity: 1 }] }) ?? "", /cannot also be the one receiving/);
    assert.match(issueError({ ...base, receiver: { membershipId: null, name: "  " }, issue: [{ lineId: "a", quantity: 1 }] }) ?? "", /Name the person receiving/);
});

test("the job waits for parts while a requisition is open, and goes back to work when none is", () => {
    assert.equal(partsStatus("WORK_IN_PROGRESS", 1), "WAITING_FOR_PARTS");
    assert.equal(partsStatus("BOOKED_IN", 2), "WAITING_FOR_PARTS");
    assert.equal(partsStatus("WAITING_FOR_PARTS", 1), null, "already waiting");
    assert.equal(partsStatus("WAITING_FOR_PARTS", 0), "WORK_IN_PROGRESS");
    assert.equal(partsStatus("JOB_COMPLETE", 1), null, "a job marked complete is left alone");
    assert.equal(partsStatus("WORK_IN_PROGRESS", 0), null);
});
