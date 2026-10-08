import { test } from "node:test";
import assert from "node:assert/strict";
import { addPeriod, anchorDayOf, periodStartFor, billingDateFromInput, billingDay, billingInputValue, decideTick, readOnlyFrom, renewalStart, standing, type RenewalRules } from "@/lib/billing/periods";

const RULES: RenewalRules = { reminderDays: 7, graceDays: 7 };
const d = (iso: string) => new Date(iso);

// ── the calendar ─────────────────────────────────────────────────────────────

test("a month on from the 7th is the 7th, at the same moment", () => {
    assert.equal(addPeriod(d("2026-10-07T15:32:19.284Z"), "MONTHLY").toISOString(), "2026-11-07T15:32:19.284Z");
});

test("a workshop that started on the 31st is due on the last day of a short month, then back on the 31st", () => {
    const feb = addPeriod(d("2027-01-31T08:00:00Z"), "MONTHLY", 31);
    assert.equal(feb.toISOString(), "2027-02-28T08:00:00.000Z");
    assert.equal(addPeriod(feb, "MONTHLY", 31).toISOString(), "2027-03-31T08:00:00.000Z");
});

test("a period dated by hand on the 31st stays on the 31st in Windhoek, not 1 March", () => {
    const jan31 = billingDateFromInput("2027-01-31")!;
    const feb = addPeriod(jan31, "MONTHLY");
    assert.equal(billingDay(feb), "28 February 2027");
    assert.equal(billingDay(addPeriod(feb, "MONTHLY", anchorDayOf(jan31))), "31 March 2027");
});

test("a leap February is used when there is one", () => {
    assert.equal(addPeriod(d("2028-01-30T00:00:00Z"), "MONTHLY").toISOString(), "2028-02-29T00:00:00.000Z");
});

test("December rolls into the next year, and quarterly and annual count months", () => {
    assert.equal(addPeriod(d("2026-12-15T00:00:00Z"), "MONTHLY").toISOString(), "2027-01-15T00:00:00.000Z");
    assert.equal(addPeriod(d("2026-11-30T00:00:00Z"), "QUARTERLY").toISOString(), "2027-02-28T00:00:00.000Z");
    assert.equal(addPeriod(d("2028-02-29T00:00:00Z"), "ANNUAL").toISOString(), "2029-02-28T00:00:00.000Z");
});

// ── where a subscription stands ──────────────────────────────────────────────

const END = d("2026-11-07T10:00:00Z");

test("standing walks current → due soon → grace → overdue on the right days", () => {
    assert.equal(standing(null, END, RULES), "undated");
    assert.equal(standing(END, d("2026-10-30T09:59:59Z"), RULES), "current");
    assert.equal(standing(END, d("2026-10-31T10:00:00Z"), RULES), "dueSoon");
    assert.equal(standing(END, d("2026-11-07T10:00:00Z"), RULES), "grace");
    assert.equal(standing(END, d("2026-11-14T09:59:59Z"), RULES), "grace");
    assert.equal(standing(END, d("2026-11-14T10:00:00Z"), RULES), "overdue");
    assert.equal(readOnlyFrom(END, RULES).toISOString(), "2026-11-14T10:00:00.000Z");
});

// ── the daily run ────────────────────────────────────────────────────────────

const fresh = { tenantStatus: "ACTIVE" as const, periodEndsAt: END, remindedFor: null, overdueNoticeFor: null };

test("nothing happens while a subscription is current", () => {
    assert.deepEqual(decideTick(fresh, d("2026-10-20T00:00:00Z"), RULES), { remind: false, markPastDue: false });
});

test("the reminder goes once per period, however often the run happens", () => {
    const day = d("2026-11-01T05:00:00Z");
    assert.deepEqual(decideTick(fresh, day, RULES), { remind: true, markPastDue: false });
    assert.deepEqual(decideTick({ ...fresh, remindedFor: END }, day, RULES), { remind: false, markPastDue: false });
    // The previous period's reminder does not count for this one.
    assert.deepEqual(decideTick({ ...fresh, remindedFor: d("2026-10-07T10:00:00Z") }, day, RULES), { remind: true, markPastDue: false });
});

test("a missed reminder is still sent during grace", () => {
    assert.deepEqual(decideTick(fresh, d("2026-11-09T05:00:00Z"), RULES), { remind: true, markPastDue: false });
});

test("past grace the workshop goes read-only once, and the reminder is not sent on top", () => {
    const late = d("2026-11-15T05:00:00Z");
    assert.deepEqual(decideTick(fresh, late, RULES), { remind: false, markPastDue: true });
    assert.deepEqual(decideTick({ ...fresh, overdueNoticeFor: END }, late, RULES), { remind: false, markPastDue: false });
});

test("the clock never overrules a person: suspended, cancelled or already past due is left alone", () => {
    const late = d("2026-12-01T00:00:00Z");
    for (const tenantStatus of ["SUSPENDED", "CANCELLED", "PAST_DUE", "PENDING_PAYMENT"] as const) {
        assert.deepEqual(decideTick({ ...fresh, tenantStatus }, late, RULES), { remind: false, markPastDue: false }, tenantStatus);
    }
});

test("an undated subscription is never reminded or marked", () => {
    assert.deepEqual(decideTick({ ...fresh, periodEndsAt: null }, d("2030-01-01T00:00:00Z"), RULES), { remind: false, markPastDue: false });
});

// ── what a renewal buys ──────────────────────────────────────────────────────

test("a workshop still active continues from where it was paid up to — early, on time or in grace", () => {
    assert.equal(renewalStart("ACTIVE", END, d("2026-11-01T00:00:00Z")).toISOString(), END.toISOString());
    assert.equal(renewalStart("ACTIVE", END, d("2026-11-12T00:00:00Z")).toISOString(), END.toISOString());
});

test("a workshop that was read-only or suspended starts again the day it pays", () => {
    const today = d("2026-12-03T09:00:00Z");
    assert.equal(renewalStart("PAST_DUE", END, today).toISOString(), today.toISOString());
    assert.equal(renewalStart("SUSPENDED", END, today).toISOString(), today.toISOString());
});

test("billing dates are Windhoek dates, written out", () => {
    // 23:30 UTC on the 6th is already the 7th in Windhoek.
    assert.equal(billingDay(d("2026-11-06T23:30:00Z")), "7 November 2026");
});

test("a typed date is the start of that day in Windhoek, and an impossible one is refused", () => {
    assert.equal(billingDateFromInput("2026-11-07")?.toISOString(), "2026-11-06T22:00:00.000Z");
    assert.equal(billingInputValue(billingDateFromInput("2026-11-07")!), "2026-11-07");
    assert.equal(billingDateFromInput("2026-02-31"), null);
    assert.equal(billingDateFromInput("7/11/2026"), null);
});

test("a period's start is one period back from its end, on the same anchor", () => {
    assert.equal(periodStartFor(d("2026-11-07T15:32:19.284Z"), "MONTHLY").toISOString(), "2026-10-07T15:32:19.284Z");
    assert.equal(periodStartFor(d("2027-01-15T00:00:00Z"), "MONTHLY").toISOString(), "2026-12-15T00:00:00.000Z");
    // Ending on 28 February in a run anchored on the 31st began on 31 January.
    assert.equal(billingDay(periodStartFor(billingDateFromInput("2027-02-28")!, "MONTHLY", 31)), "31 January 2027");
    assert.equal(periodStartFor(d("2027-02-15T00:00:00Z"), "QUARTERLY").toISOString(), "2026-11-15T00:00:00.000Z");
});
