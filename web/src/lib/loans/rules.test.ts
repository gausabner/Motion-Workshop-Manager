import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingError, elapsedLabel, handOverError, isOverdue, loanSummary, overlaps, returnError } from "./rules";

const at = (s: string) => new Date(`2026-09-${s}:00Z`);

test("two loans of one car clash whenever their days touch", () => {
    const monday = { outAt: at("21T08"), dueBackAt: at("22T17") };
    assert.equal(overlaps(monday, { outAt: at("22T08"), dueBackAt: at("23T17") }), true, "overlapping");
    assert.equal(overlaps(monday, { outAt: at("22T17"), dueBackAt: at("23T17") }), false, "starting as the other ends is fine");
    assert.equal(overlaps(monday, { outAt: at("19T08"), dueBackAt: at("20T17") }), false, "before");
    assert.equal(overlaps(monday, { outAt: at("23T08"), dueBackAt: at("24T17") }), false, "after");
});

test("a car already back frees the days it was going to be out", () => {
    const cameBackEarly = { outAt: at("21T08"), dueBackAt: at("25T17"), inAt: at("22T09") };
    assert.equal(overlaps({ outAt: at("23T08"), dueBackAt: at("24T17") }, cameBackEarly), false);
});

test("a booking is refused when the car is promised, or the dates are backwards", () => {
    const existing = [{ outAt: at("21T08"), dueBackAt: at("22T17") }];
    assert.match(bookingError({ outAt: at("21T10"), dueBackAt: at("21T16") }, existing)!, /promised to somebody else/);
    assert.match(bookingError({ outAt: at("24T10"), dueBackAt: at("24T08") }, [])!, /come back after it goes out/);
    assert.equal(bookingError({ outAt: at("23T08"), dueBackAt: at("24T17") }, existing), null);
});

test("overdue means out and past its time, not merely late in the day", () => {
    assert.equal(isOverdue({ state: "OUT", dueBackAt: at("20T17") }, at("21T09")), true);
    assert.equal(isOverdue({ state: "OUT", dueBackAt: at("22T17") }, at("21T09")), false);
    assert.equal(isOverdue({ state: "RETURNED", dueBackAt: at("20T17") }, at("21T09")), false, "a car that is back is not overdue");
    assert.equal(isOverdue({ state: "BOOKED", dueBackAt: at("20T17") }, at("21T09")), false);
});

test("handing over and taking back are each possible once", () => {
    assert.equal(handOverError("BOOKED"), null);
    assert.match(handOverError("OUT")!, /already out/);
    assert.match(handOverError("RETURNED")!, /finished/);
    assert.equal(returnError("OUT", at("21T08"), at("22T09"), 50000, 50320), null);
    assert.match(returnError("BOOKED", at("21T08"), at("22T09"), null, null)!, /not out/);
    assert.match(returnError("OUT", at("22T08"), at("21T09"), null, null)!, /before it went out/);
    assert.match(returnError("OUT", at("21T08"), at("22T09"), 50000, 49000)!, /less than the 50000/);
});

test("how far it went and how long it was gone", () => {
    const summary = loanSummary({ outAt: at("21T08"), inAt: at("22T09"), odometerOut: 50000, odometerIn: 50320 }, at("25T08"));
    assert.deepEqual(summary, { hours: 25, days: 2, distance: 320, elapsed: "1 day out" });
    const stillOut = loanSummary({ outAt: at("21T08"), inAt: null, odometerOut: 50000, odometerIn: null }, at("21T14"));
    assert.deepEqual(stillOut, { hours: 6, days: 1, distance: null, elapsed: "6 hours out" });
});

test("a car handed over a minute ago has not been out for zero hours", () => {
    assert.equal(elapsedLabel(0), "just gone out");
    assert.equal(elapsedLabel(0.9), "just gone out");
    assert.equal(elapsedLabel(1), "1 hour out");
    assert.equal(elapsedLabel(23.6), "24 hours out");
    assert.equal(elapsedLabel(25), "1 day out");
    assert.equal(elapsedLabel(72), "3 days out");
});
