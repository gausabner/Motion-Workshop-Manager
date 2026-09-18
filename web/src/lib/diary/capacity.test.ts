import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DIARY, availableMinutes, clashes, dayLoad, isFull, lanesWithin, snapMinute, union, workingInterval } from "./capacity";

const shop = DEFAULT_DIARY; // 07:30–17:00, Mon–Fri

test("a mechanic works the shop's hours unless their own say otherwise", () => {
    assert.deepEqual(workingInterval(2, shop), { start: 450, end: 1020 });
    assert.equal(workingInterval(6, shop), null);
    assert.deepEqual(workingInterval(6, shop, { weekday: 6, startMinute: 480, endMinute: 780 }), { start: 480, end: 780 });
    // Equal start and end is how a regular day off is written.
    assert.equal(workingInterval(3, shop, { weekday: 3, startMinute: 0, endMinute: 0 }), null);
});

test("time off comes out of the day once, even when two entries overlap", () => {
    const working = { start: 450, end: 1020 }; // 570 minutes
    assert.equal(availableMinutes(working, []), 570);
    assert.equal(availableMinutes(working, [{ start: 480, end: 600 }, { start: 540, end: 660 }]), 570 - 180);
    assert.equal(availableMinutes(working, [{ start: 0, end: 1440 }]), 0);
    assert.equal(availableMinutes(null, []), 0);
    assert.deepEqual(union([{ start: 540, end: 660 }, { start: 480, end: 600 }]), [{ start: 480, end: 660 }]);
});

test("the shop's load counts unassigned work, a mechanic's only their own", () => {
    const mechanics = [
        { mechanicId: "mike", working: { start: 450, end: 1020 }, off: [] },
        { mechanicId: "sara", working: { start: 450, end: 1020 }, off: [] },
    ];
    const { shop: whole, byMechanic } = dayLoad(mechanics, [
        { id: "a", mechanicId: "mike", start: 480, minutes: 285 },
        { id: "b", mechanicId: null, start: 600, minutes: 285 },
    ]);
    assert.deepEqual(byMechanic.mike, { available: 570, booked: 285, percent: 50 });
    assert.deepEqual(byMechanic.sara, { available: 570, booked: 0, percent: 0 });
    assert.deepEqual(whole, { available: 1140, booked: 570, percent: 50 });
});

test("a day with nobody working but work booked reads as full, not as 0%", () => {
    const { shop: whole } = dayLoad([{ mechanicId: "mike", working: null, off: [] }], [{ id: "a", mechanicId: "mike", start: 480, minutes: 60 }]);
    assert.equal(whole.percent, 100);
});

test("full is the workshop's own threshold", () => {
    assert.equal(isFull(89, shop), false);
    assert.equal(isFull(90, shop), true);
    assert.equal(isFull(95, { fullAtPercent: 100 }), false);
});

test("clashes are found and back-to-back is not a clash", () => {
    const found = clashes([
        { id: "a", mechanicId: "m", start: 480, minutes: 60 },
        { id: "b", mechanicId: "m", start: 540, minutes: 60 },
        { id: "c", mechanicId: "m", start: 570, minutes: 30 },
    ]);
    assert.deepEqual([...found].sort(), ["b", "c"]);
});

test("a drop snaps to the slot and never falls off the end of the day", () => {
    const bounds = { start: 450, end: 1020 };
    assert.equal(snapMinute(532, shop, bounds), 540);
    assert.equal(snapMinute(300, shop, bounds), 450);
    assert.equal(snapMinute(1100, shop, bounds), 990);
});

test("overlapping bookings sit side by side instead of one hiding the other", () => {
    const layout = lanesWithin([
        { id: "a", mechanicId: "m", start: 480, minutes: 120 },
        { id: "b", mechanicId: "m", start: 510, minutes: 60 },
        { id: "c", mechanicId: "m", start: 720, minutes: 60 },
    ]);
    assert.deepEqual(layout.a, { column: 0, columns: 2 });
    assert.deepEqual(layout.b, { column: 1, columns: 2 });
    assert.deepEqual(layout.c, { column: 0, columns: 1 });
});

test("diary settings fill their defaults and survive junk", async () => {
    const { diarySettings } = await import("@/lib/settings/schema");
    assert.deepEqual(diarySettings({}), DEFAULT_DIARY);
    assert.deepEqual(diarySettings({ diary: { opensAt: "nonsense" } }), DEFAULT_DIARY);
    const custom = diarySettings({ diary: { opensAt: "08:00", closesAt: "13:00", workingDays: [6, 1, 1], slotMinutes: 15 } });
    assert.equal(custom.opensAt, 480);
    assert.equal(custom.closesAt, 780);
    assert.deepEqual(custom.workingDays, [1, 6]);
    // A close before the open cannot produce a negative day.
    assert.ok(diarySettings({ diary: { opensAt: "12:00", closesAt: "08:00" } }).closesAt > 720);
});
