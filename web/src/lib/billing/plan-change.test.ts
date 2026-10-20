import { test } from "node:test";
import assert from "node:assert/strict";
import { amountDue, changeKind, featureDiff, requestRefusal, requestablePlans, unusedDays, upgradePeriod } from "@/lib/billing/plan-change";

const d = (iso: string) => new Date(iso);
const active = { status: "ACTIVE" as const, planId: "workshop", periodEndsAt: d("2026-11-07T10:00:00.000Z") };

test("a move to a higher plan is an upgrade, to a lower one a downgrade, to the same one nothing", () => {
    assert.equal(changeKind("workshop", "full"), "upgrade");
    assert.equal(changeKind("full", "workshop"), "downgrade");
    assert.equal(changeKind("full", "full"), null);
});

test("a move up costs one full period at the new price, with VAT; a move down costs nothing now", () => {
    assert.deepEqual(amountDue("upgrade", 2400), { exclVat: 2400, inclVat: 2760 });
    assert.deepEqual(amountDue("downgrade", 1200), { exclVat: 0, inclVat: 0 });
});

test("a confirmed move up restarts the period from that day, on that day of the month", () => {
    const { from, to } = upgradePeriod(d("2026-10-20T09:00:00.000Z"), "MONTHLY");
    assert.equal(from.toISOString(), "2026-10-20T09:00:00.000Z");
    assert.equal(to.toISOString(), "2026-11-20T09:00:00.000Z");
});

test("the days given up are whole days left on the current period, never negative", () => {
    assert.equal(unusedDays(d("2026-11-07T10:00:00.000Z"), d("2026-10-20T09:00:00.000Z")), 18);
    assert.equal(unusedDays(d("2026-10-01T00:00:00.000Z"), d("2026-10-20T09:00:00.000Z")), 0);
    assert.equal(unusedDays(null, d("2026-10-20T09:00:00.000Z")), 0);
});

test("moving up names what is added; moving down names what is locked", () => {
    const up = featureDiff("workshop", "full");
    assert.ok(up.gained.includes("Purchasing and suppliers"));
    assert.equal(up.lost.length, 0);
    const down = featureDiff("full", "workshop");
    assert.ok(down.lost.includes("Parts and stock"));
    assert.equal(down.gained.length, 0);
});

test("an owner can ask for any priced plan except the one they are on", () => {
    assert.deepEqual(requestablePlans("workshop").map((p) => p.id), ["full"]);
    assert.deepEqual(requestablePlans("full").map((p) => p.id), ["workshop"]);
});

test("a request is refused, with the reason, when it cannot go ahead", () => {
    const ok = { tenantStatus: "ACTIVE" as const, subscription: active, toPlanId: "full", hasPending: false };
    assert.equal(requestRefusal(ok), null);
    assert.match(requestRefusal({ ...ok, toPlanId: "council" })!, /quoted per site/);
    assert.match(requestRefusal({ ...ok, toPlanId: "workshop" })!, /already on the Workshop plan/);
    assert.match(requestRefusal({ ...ok, hasPending: true })!, /already have a plan change waiting/);
    assert.match(requestRefusal({ ...ok, tenantStatus: "PAST_DUE" })!, /overdue/);
    assert.match(requestRefusal({ ...ok, subscription: null })!, /arranged directly/);
    assert.match(requestRefusal({ ...ok, toPlanId: "nonsense" })!, /Choose a plan/);
});
