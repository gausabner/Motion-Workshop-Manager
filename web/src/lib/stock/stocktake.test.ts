import { test } from "node:test";
import assert from "node:assert/strict";
import { applyError, outcomes, summarise, variance, varianceValue, type CountLine } from "./stocktake";

const line = (over: Partial<CountLine> = {}): CountLine => ({ productId: "p1", expected: 10, counted: 10, onHand: 10, unitCost: 100, ...over });

test("a count that agrees posts nothing", () => {
    assert.equal(variance(line()), 0);
    assert.deepEqual(outcomes([line()])[0].adjustment, 0);
    assert.equal(summarise([line()]).agreeing, 1);
});

test("short and over are the two directions, valued at cost", () => {
    assert.equal(variance(line({ counted: 7 })), -3);
    assert.equal(varianceValue(line({ counted: 7 })), -300);
    assert.equal(variance(line({ counted: 12 })), 2);
    assert.equal(varianceValue(line({ counted: 12 })), 200);
});

test("a line nobody counted is left alone", () => {
    assert.equal(variance(line({ counted: null })), null);
    assert.deepEqual(outcomes([line({ counted: null })]), [], "an unfinished sheet must not write stock off");
    const s = summarise([line({ counted: null }), line({ productId: "p2", counted: 4 })]);
    assert.deepEqual([s.counted, s.uncounted], [1, 1]);
});

test("stock that moved while the shelf was being counted is adjusted against the ledger now, and flagged", () => {
    // The sheet said 10, two were sold during the count, and 8 were found: the shelf is right.
    const sold = line({ expected: 10, counted: 8, onHand: 8 });
    const [result] = outcomes([sold]);
    assert.equal(result.variance, -2, "against the sheet it reads short");
    assert.equal(result.adjustment, 0, "against the ledger nothing needs posting");
    assert.equal(result.movedDuringCount, true);

    // The sheet said 10, two were sold, and 10 were found: two are genuinely unaccounted for.
    const [real] = outcomes([line({ expected: 10, counted: 10, onHand: 8 })]);
    assert.equal(real.adjustment, 2);
    assert.equal(real.movedDuringCount, true);
});

test("the summary is what an owner reads off the top", () => {
    const s = summarise([
        line({ productId: "a", counted: 10 }),
        line({ productId: "b", counted: 7, unitCost: 50 }),
        line({ productId: "c", counted: 12, unitCost: 20 }),
        line({ productId: "d", counted: null }),
        line({ productId: "e", counted: 5, onHand: 4 }),
    ]);
    assert.equal(s.lines, 5);
    assert.equal(s.counted, 4);
    assert.equal(s.short, 2);
    assert.equal(s.over, 1);
    assert.equal(s.movedDuringCount, 1);
    // b is 3 short at 50, c is 2 over at 20, e is 5 short at 100 against the sheet.
    assert.equal(s.value, -610);
});

test("a count cannot be applied twice, or empty", () => {
    assert.match(applyError("APPLIED", 4)!, /already been applied/);
    assert.match(applyError("DRAFT", 0)!, /Nothing has been counted/);
    assert.equal(applyError("DRAFT", 4), null);
});
