import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, formatLocalDateTime, fromZoned, offsetMinutes, parseLocalDateTime, parseMinute, startOfWeek, toZoned, weekdayOf } from "./time";

test("09:00 in Windhoek is 07:00 UTC, whatever zone the server runs in", () => {
    assert.equal(parseLocalDateTime("2026-09-22T09:00", "Africa/Windhoek")?.toISOString(), "2026-09-22T07:00:00.000Z");
    assert.equal(parseLocalDateTime("2026-09-22T09:00", "Africa/Johannesburg")?.toISOString(), "2026-09-22T07:00:00.000Z");
});

test("a stored instant reads back as the wall-clock time that was typed", () => {
    const at = parseLocalDateTime("2026-09-22T14:30", "Africa/Windhoek")!;
    assert.equal(formatLocalDateTime(at, "Africa/Windhoek"), "2026-09-22T14:30");
    assert.deepEqual(toZoned(at, "Africa/Windhoek"), { day: "2026-09-22", minute: 870, weekday: 2 });
});

test("just after midnight local is still the new day, not yesterday in UTC", () => {
    const at = new Date("2026-09-21T22:30:00Z");
    assert.deepEqual(toZoned(at, "Africa/Windhoek"), { day: "2026-09-22", minute: 30, weekday: 2 });
});

test("a zone with daylight saving converts correctly on both sides of the change", () => {
    // London moves from BST (+1) to GMT (0) on 25 October 2026.
    assert.equal(offsetMinutes(new Date("2026-10-24T12:00:00Z"), "Europe/London"), 60);
    assert.equal(offsetMinutes(new Date("2026-10-26T12:00:00Z"), "Europe/London"), 0);
    assert.equal(fromZoned("2026-10-24", 9 * 60, "Europe/London").toISOString(), "2026-10-24T08:00:00.000Z");
    assert.equal(fromZoned("2026-10-26", 9 * 60, "Europe/London").toISOString(), "2026-10-26T09:00:00.000Z");
});

test("rubbish in gives nothing back rather than a wrong booking", () => {
    assert.equal(parseLocalDateTime("", "Africa/Windhoek"), null);
    assert.equal(parseLocalDateTime("2026-09-22T25:00", "Africa/Windhoek"), null);
    assert.equal(parseLocalDateTime("tomorrow", "Africa/Windhoek"), null);
    assert.equal(parseMinute("7:30"), 450);
    assert.equal(parseMinute("24:00"), 1440);
    assert.equal(parseMinute("24:30"), null);
});

test("calendar arithmetic crosses months and finds the Monday", () => {
    assert.equal(addDays("2026-09-30", 1), "2026-10-01");
    assert.equal(weekdayOf("2026-09-20"), 7);
    assert.equal(startOfWeek("2026-09-20"), "2026-09-14");
    assert.equal(startOfWeek("2026-09-21"), "2026-09-21");
});
