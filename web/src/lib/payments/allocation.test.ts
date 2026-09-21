import { test } from "node:test";
import assert from "node:assert/strict";
import { ageItems, ageingBucket, allocationTotal, normalise, refundable, spread, spreadRefund, type OpenItem } from "./allocation";

const item = (over: Partial<OpenItem> & { id: string; outstanding: number }): OpenItem => ({
    type: "INVOICE",
    number: over.id.toUpperCase(),
    postDate: "2026-09-01",
    dueDate: null,
    reference: null,
    total: over.outstanding,
    ...over,
});

test("All spreads the money across open invoices, oldest first", () => {
    const items = [
        item({ id: "b", outstanding: 1000, dueDate: "2026-08-15" }),
        item({ id: "a", outstanding: 800, dueDate: "2026-07-01" }),
    ];
    assert.deepEqual(spread(items, 1500), { a: 800, b: 700 });
});

test("All stops when the money runs out and leaves the rest untouched", () => {
    const items = [item({ id: "a", outstanding: 800 }), item({ id: "b", outstanding: 1000 })];
    const result = spread(items, 500);
    assert.deepEqual(result, { a: 500 });
    assert.equal(allocationTotal(result), 500);
});

test("a credit note is taken up first and pays for part of the invoice", () => {
    const items = [
        item({ id: "inv", outstanding: 1000, dueDate: "2026-08-01" }),
        item({ id: "cr", type: "CREDIT", outstanding: -300, dueDate: "2026-08-20" }),
    ];
    // The customer hands over 700; the credit covers the rest.
    const result = spread(items, 700);
    assert.deepEqual(result, { cr: -300, inv: 1000 });
    assert.equal(allocationTotal(result), 700);
});

test("with nothing tendered, All is a pure credit application", () => {
    const items = [item({ id: "inv", outstanding: 1000 }), item({ id: "cr", type: "CREDIT", outstanding: -400 })];
    const result = spread(items, 0);
    assert.deepEqual(result, { cr: -400, inv: 400 });
    assert.equal(allocationTotal(result), 0);
});

test("a credit bigger than the debt is only drawn on for what is owed", () => {
    // The live check that caught this: a N$1,820 credit note against a N$1,200 invoice.
    const items = [item({ id: "cr", type: "CREDIT", outstanding: -1820 }), item({ id: "inv", outstanding: 1200 })];
    const result = spread(items, 0);
    assert.deepEqual(result, { cr: -1200, inv: 1200 });
    assert.equal(allocationTotal(result), 0);
});

test("cash that covers the debt leaves the credit note alone", () => {
    const items = [item({ id: "inv", outstanding: 1800 }), item({ id: "cr", type: "CREDIT", outstanding: -300 })];
    const result = spread(items, 2000);
    assert.deepEqual(result, { inv: 1800 });
});

test("normalise trims what a document cannot absorb and drops the zeroes", () => {
    const items = [item({ id: "inv", outstanding: 500 }), item({ id: "cr", type: "CREDIT", outstanding: -200 })];
    assert.deepEqual(normalise(items, { inv: 900, cr: -50, gone: 100, zero: 0 }), { inv: 500, cr: -50 });
});

test("normalise refuses an allocation pointed the wrong way", () => {
    const items = [item({ id: "inv", outstanding: 500 })];
    assert.deepEqual(normalise(items, { inv: -100 }), {});
});

test("a refund draws credit notes down oldest first, and ignores invoices", () => {
    const items = [
        item({ id: "inv", outstanding: 900 }),
        item({ id: "new", type: "CREDIT", outstanding: -400, postDate: "2026-09-10" }),
        item({ id: "old", type: "CREDIT", outstanding: -300, postDate: "2026-07-01" }),
    ];
    assert.deepEqual(spreadRefund(items, 500), { old: -300, new: -200 });
    assert.deepEqual(spreadRefund(items, 1000), { old: -300, new: -400 });
    assert.deepEqual(spreadRefund(items, 0), {});
});

test("what can be handed back is the credit notes plus money already on account", () => {
    const items = [item({ id: "inv", outstanding: 900 }), item({ id: "cr", type: "CREDIT", outstanding: -620 })];
    assert.equal(refundable(items, 500), 1120);
    assert.equal(refundable(items, 0), 620);
    assert.equal(refundable([item({ id: "inv", outstanding: 900 })], 0), 0);
});

test("ageing buckets follow the due date, not the post date", () => {
    const asAt = new Date("2026-09-18T00:00:00Z");
    assert.equal(ageingBucket("2026-09-10", asAt), "current");
    assert.equal(ageingBucket("2026-08-18", asAt), "d30");
    assert.equal(ageingBucket("2026-07-18", asAt), "d60");
    assert.equal(ageingBucket("2026-05-01", asAt), "d90");
});

test("a statement ages every open item into its column", () => {
    const asAt = new Date("2026-09-18T00:00:00Z");
    const ageing = ageItems(
        [
            { dueDate: "2026-09-10", postDate: "2026-09-10", outstanding: 1000 },
            { dueDate: "2026-08-01", postDate: "2026-08-01", outstanding: 250.5 },
            { dueDate: null, postDate: "2026-04-01", outstanding: -100 },
        ],
        asAt,
    );
    assert.deepEqual(ageing, { current: 1000, d30: 250.5, d60: 0, d90: -100, total: 1150.5 });
});
