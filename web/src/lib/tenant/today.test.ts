import { test } from "node:test";
import assert from "node:assert/strict";
import { businessToday } from "./today";

const iso = (d: Date) => d.toISOString();

test("just after midnight in Windhoek books to the new day, not yesterday", () => {
    // 01:49 on the 18th in Windhoek is still the 17th in UTC.
    const at = new Date("2026-09-17T23:49:00Z");
    assert.equal(iso(businessToday("Africa/Windhoek", at)), "2026-09-18T00:00:00.000Z");
    assert.equal(iso(businessToday("UTC", at)), "2026-09-17T00:00:00.000Z");
});

test("late evening UTC-side workshops keep their own day", () => {
    // 21:00 on the 17th in Auckland is 09:00 on the 17th in UTC.
    const at = new Date("2026-09-17T09:00:00Z");
    assert.equal(iso(businessToday("Pacific/Auckland", at)), "2026-09-17T00:00:00.000Z");
    // …but 13:00 UTC is already the 18th there.
    assert.equal(iso(businessToday("Pacific/Auckland", new Date("2026-09-17T13:00:00Z"))), "2026-09-18T00:00:00.000Z");
});

test("the returned value is midnight, which is what a date column stores", () => {
    const day = businessToday("Africa/Windhoek", new Date("2026-03-04T12:00:00Z"));
    assert.equal(iso(day), "2026-03-04T00:00:00.000Z");
});
