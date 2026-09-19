import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderSettingsSchema } from "@/lib/settings/schema";
import { followUpDay, inWindow, relativeDay, windowFor } from "./rules";

const defaults = reminderSettingsSchema.parse({});
const today = "2026-09-19";

test("defaults: every reminder on, with sensible lead times", () => {
    assert.deepEqual(defaults.service, { enabled: true, days: 14 });
    assert.deepEqual(defaults.booking, { enabled: true, days: 1 });
    assert.deepEqual(defaults.quote, { enabled: true, days: 3 });
});

test("a service shows from a month overdue to two weeks ahead", () => {
    const w = windowFor("SERVICE_DUE", today, defaults)!;
    assert.deepEqual(w, { from: "2026-08-20", to: "2026-10-03" });
    assert.ok(inWindow("2026-10-03", w));
    assert.ok(!inWindow("2026-10-04", w));
    assert.ok(inWindow("2026-08-20", w));
    assert.ok(!inWindow("2026-08-19", w), "stale after 30 days");
});

test("a booking reminder never looks backwards", () => {
    assert.deepEqual(windowFor("BOOKING", today, defaults), { from: "2026-09-19", to: "2026-09-20" });
});

test("a quote sent on the 16th is due for follow-up on the 19th, not the 18th", () => {
    const w = windowFor("QUOTE_FOLLOW_UP", today, defaults)!;
    assert.ok(inWindow("2026-09-16", w));
    assert.ok(!inWindow("2026-09-17", w));
    assert.equal(followUpDay("QUOTE_FOLLOW_UP", "2026-09-16", defaults), "2026-09-19");
});

test("a switched-off reminder has no window", () => {
    const off = reminderSettingsSchema.parse({ licence: { enabled: false, days: 21 } });
    assert.equal(windowFor("LICENCE_DISC", today, off), null);
    assert.ok(windowFor("ROADWORTHY", today, off));
});

test("relative days read naturally", () => {
    assert.equal(relativeDay("2026-09-19", today), "today");
    assert.equal(relativeDay("2026-09-20", today), "tomorrow");
    assert.equal(relativeDay("2026-09-12", today), "7 days ago");
    assert.equal(relativeDay("2026-10-01", today), "in 12 days");
});
