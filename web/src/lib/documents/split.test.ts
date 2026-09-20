import { test } from "node:test";
import assert from "node:assert/strict";
import { excessError, linesSplitError, reworkError, splitByExcess, splitError, splitPreview, type SplitLine } from "./split";

const lines: SplitLine[] = [
    { id: "a", description: "Panel", lineTotal: 8000 },
    { id: "b", description: "Paint", lineTotal: 3500 },
    { id: "c", description: "Wiper blades", lineTotal: 450 },
];

test("only a draft job can be split", () => {
    assert.equal(splitError("DRAFT", "JOB_CARD", 3), null);
    assert.match(splitError("PROCESSED", "INVOICE", 3)!, /Only a draft/);
    assert.match(splitError("DRAFT", "CREDIT", 3)!, /credit note cannot be split/);
    assert.match(splitError("DRAFT", "JOB_CARD", 0)!, /nothing on this document/);
});

test("an excess split adds back up to the job, always", () => {
    assert.deepEqual(splitByExcess(11950, 3500), { toPayer: 8450, toOriginal: 3500 });
    const split = splitByExcess(11950, 3500);
    assert.equal(round(split.toPayer + split.toOriginal), 11950);
});

test("an excess bigger than the job leaves nothing for the insurer, and never goes negative", () => {
    assert.deepEqual(splitByExcess(2000, 5000), { toPayer: 0, toOriginal: 2000 });
    assert.deepEqual(splitByExcess(2000, 2000), { toPayer: 0, toOriginal: 2000 });
    assert.deepEqual(splitByExcess(2000, -100), { toPayer: 2000, toOriginal: 0 });
    assert.match(excessError(2000, 5000)!, /more than the job's/);
    assert.match(excessError(2000, 0)!, /Enter the excess/);
    assert.equal(excessError(2000, 500), null);
});

test("splitting by line shows both sides before anything is created", () => {
    const preview = splitPreview(lines, new Set(["a", "b"]));
    assert.deepEqual(preview, { moved: 11500, kept: 450, movedCount: 2 });
    assert.equal(round(preview.moved + preview.kept), 11950, "the two halves are still the whole job");
});

test("moving everything is a change of customer, not a split", () => {
    assert.match(linesSplitError(lines, new Set())!, /Choose the lines/);
    assert.match(linesSplitError(lines, new Set(["a", "b", "c"]))!, /Change the customer/);
    assert.equal(linesSplitError(lines, new Set(["a"])), null);
});

test("a job can only be redone once it has been done", () => {
    assert.equal(reworkError("PROCESSED", "JOB_CARD"), null);
    assert.equal(reworkError("CLOSED", "INVOICE"), null);
    assert.match(reworkError("DRAFT", "JOB_CARD")!, /has not been processed/);
    assert.match(reworkError("VOID", "INVOICE")!, /was voided/);
    assert.match(reworkError("PROCESSED", "QUOTE")!, /job card or an invoice/);
});

function round(n: number): number {
    return Math.round(n * 100) / 100;
}
