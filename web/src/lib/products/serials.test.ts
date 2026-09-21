import { test } from "node:test";
import assert from "node:assert/strict";
import { allocationError, formatSerials, inWarranty, parseSerials, serialCountError, sellable, warrantyUntil } from "./serials";

test("serials are read however they are typed", () => {
    assert.deepEqual(parseSerials("A1, A2\nA3;A4"), ["A1", "A2", "A3", "A4"]);
    assert.deepEqual(parseSerials("  bat-001 ,bat-002 "), ["BAT-001", "BAT-002"], "case is levelled so lookups match");
    assert.deepEqual(parseSerials("A1, A1, a1"), ["A1"], "the same one twice is once");
    assert.deepEqual(parseSerials(""), []);
    assert.deepEqual(parseSerials(null), []);
    assert.equal(formatSerials(["A1", "A2"]), "A1, A2");
});

test("a serialised line must name exactly as many units as it moves", () => {
    assert.equal(serialCountError(false, 3, []), null, "an unserialised product needs none");
    assert.match(serialCountError(true, 2, [])!, /needs 2 serial numbers/);
    assert.match(serialCountError(true, 2, ["A1"])!, /covers 2 units but names 1 serial number/);
    assert.match(serialCountError(true, 1, ["A1", "A2"])!, /covers 1 unit but names 2 serial numbers/);
    assert.equal(serialCountError(true, 2, ["A1", "A2"]), null);
    // A credit note returns two of them, and still needs to say which two.
    assert.equal(serialCountError(true, -2, ["A1", "A2"]), null);
    assert.match(serialCountError(true, -2, ["A1"])!, /covers 2 units/);
});

test("warranty runs in whole months from the day it was sold", () => {
    assert.deepEqual(warrantyUntil(new Date("2026-09-20T00:00:00Z"), 24), new Date("2028-09-20T00:00:00Z"));
    assert.deepEqual(warrantyUntil(new Date("2026-01-31T00:00:00Z"), 1), new Date("2026-02-28T00:00:00Z"), "a short month keeps the last day");
    assert.equal(warrantyUntil(new Date("2026-09-20T00:00:00Z"), null), null);
    assert.equal(warrantyUntil(new Date("2026-09-20T00:00:00Z"), 0), null);
});

test("in warranty on the last day, out of it the day after", () => {
    const ends = new Date("2028-09-20T00:00:00Z");
    assert.equal(inWarranty(ends, new Date("2028-09-20T00:00:00Z")), true);
    assert.equal(inWarranty(ends, new Date("2028-09-21T00:00:00Z")), false);
    assert.equal(inWarranty(null, new Date()), false);
});

test("what may go out again", () => {
    assert.equal(sellable("IN_STOCK"), true);
    assert.equal(sellable("RETURNED"), true, "a unit that came back can be sold again");
    assert.equal(sellable("SOLD"), false);
    assert.equal(sellable("WRITTEN_OFF"), false);
});

test("a serial already sold cannot go out twice, but an unknown one is allowed through", () => {
    const known = [
        { serial: "A1", state: "SOLD" as const, documentLineId: "line-1" },
        { serial: "A2", state: "IN_STOCK" as const, documentLineId: null },
        { serial: "A3", state: "WRITTEN_OFF" as const, documentLineId: null },
    ];
    assert.match(allocationError(["A1"], known, "line-2")!, /already been sold/);
    assert.equal(allocationError(["A1"], known, "line-1"), null, "the line it was sold on may keep it");
    assert.equal(allocationError(["A2"], known, "line-2"), null);
    assert.match(allocationError(["A3"], known, "line-2")!, /written off/);
    assert.equal(allocationError(["NEW-1"], known, "line-2"), null, "arriving before the paperwork is normal");
});
