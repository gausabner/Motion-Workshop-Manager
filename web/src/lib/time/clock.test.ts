import { test } from "node:test";
import assert from "node:assert/strict";
import { efficiency, entryMinutes, hoursLabel, isSuspect, splitCharged } from "./clock";

test("minutes are rounded to the nearest, and a clock that ran backwards is zero, not negative", () => {
    const at = (s: string) => new Date(`2026-09-18T${s}Z`);
    assert.equal(entryMinutes(at("08:00:00"), at("10:30:00")), 150);
    assert.equal(entryMinutes(at("08:00:00"), at("08:00:40")), 1);
    assert.equal(entryMinutes(at("08:00:00"), at("07:00:00")), 0);
});

test("a clock left running overnight is flagged, a long day's job is not", () => {
    assert.equal(isSuspect(9 * 60), false);
    assert.equal(isSuspect(14 * 60), true);
});

test("charged hours are shared by time actually spent, and add back up exactly", () => {
    // A 3h job: Mike did 2h, Sara 1h.
    assert.deepEqual(splitCharged(180, { mike: 120, sara: 60 }), { mike: 120, sara: 60 });
    // Awkward thirds must not lose a minute.
    const shares = splitCharged(100, { a: 1, b: 1, c: 1 });
    assert.equal(Object.values(shares).reduce((s, m) => s + m, 0), 100);
    // Nobody clocked any time: split evenly rather than dividing by zero.
    assert.deepEqual(splitCharged(90, { a: 0, b: 0 }), { a: 45, b: 45 });
    assert.deepEqual(splitCharged(90, {}), {});
});

test("efficiency is charged over worked, and nothing worked is not 0%", () => {
    assert.equal(efficiency(180, 150), 120);
    assert.equal(efficiency(120, 180), 67);
    assert.equal(efficiency(60, 0), null);
});

test("hours read the way a workshop says them", () => {
    assert.equal(hoursLabel(45), "45 min");
    assert.equal(hoursLabel(150), "2h 30");
    assert.equal(hoursLabel(120), "2h");
});
