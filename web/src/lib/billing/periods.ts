import type { BillingPeriod, TenantStatus } from "@prisma/client";

/**
 * The calendar of a subscription, as pure functions.
 *
 * Kept free of the database and the clock so the rules can be tested on the
 * dates where they go wrong: the 31st, February, a renewal paid late, a
 * renewal paid early, and the day the grace period ends.
 */

const MONTHS: Record<BillingPeriod, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };
const DAY = 24 * 60 * 60 * 1000;

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Windhoek is UTC+2 all year — it has not observed daylight saving since 2017 —
 * so billing arithmetic happens on the Windhoek calendar by shifting two hours.
 * Done in UTC instead, a period dated "31 January" (22:00 on the 30th, UTC)
 * would land on 28 February UTC, which is 1 March in Windhoek.
 */
const BILLING_OFFSET = 2 * 60 * 60 * 1000;

/** The day of the month `d` falls on in Windhoek: the anchor a run of periods keeps. */
export function anchorDayOf(d: Date): number {
    return new Date(d.getTime() + BILLING_OFFSET).getUTCDate();
}

/**
 * One period on from `from`, landing on `anchorDay` where the month has it.
 *
 * The anchor is the day the run of periods started on. Without it, a workshop
 * that started on 31 January is due 28 February, then 28 March, and has
 * quietly lost three days a year; with it, it is due 28 February and back on
 * 31 March. The time of day is kept, so a period always ends at the moment it
 * began.
 */
export function addPeriod(from: Date, period: BillingPeriod, anchorDay = anchorDayOf(from)): Date {
    return shiftMonths(from, MONTHS[period], anchorDay);
}

/**
 * Where the period that ends at `to` began — one period back, on the same
 * anchor. For dating a payment that was made before MOTION recorded payments.
 */
export function periodStartFor(to: Date, period: BillingPeriod, anchorDay = anchorDayOf(to)): Date {
    return shiftMonths(to, -MONTHS[period], anchorDay);
}

function shiftMonths(from: Date, months: number, anchorDay: number): Date {
    const local = new Date(from.getTime() + BILLING_OFFSET);
    const m = local.getUTCMonth() + months;
    const year = local.getUTCFullYear() + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    const day = Math.min(anchorDay, daysInMonth(year, month));
    const shifted = Date.UTC(year, month, day, local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(), local.getUTCMilliseconds());
    return new Date(shifted - BILLING_OFFSET);
}

export type RenewalRules = {
    /** Days before the end of a period that the reminder goes out. */
    reminderDays: number;
    /** Days after the end of a period before the workshop becomes read-only. */
    graceDays: number;
};

function intFromEnv(name: string, fallback: number): number {
    const n = Number.parseInt(process.env[name] ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Seven and seven unless the server says otherwise. */
export function renewalRules(): RenewalRules {
    return { reminderDays: intFromEnv("BILLING_REMINDER_DAYS", 7), graceDays: intFromEnv("BILLING_GRACE_DAYS", 7) };
}

/** When a period that ends at `periodEndsAt` stops being in grace. */
export function readOnlyFrom(periodEndsAt: Date, rules: RenewalRules): Date {
    return new Date(periodEndsAt.getTime() + rules.graceDays * DAY);
}

/**
 * Where a subscription stands today, in the words the screens use.
 *
 * - `undated`: nothing to renew — not yet confirmed, or never given a date.
 * - `current`: paid, and the reminder is not due yet.
 * - `dueSoon`: inside the reminder window.
 * - `grace`: the period has ended; still fully usable until `readOnlyFrom`.
 * - `overdue`: past grace. The daily run moves the workshop to `PAST_DUE`.
 */
export type Standing = "undated" | "current" | "dueSoon" | "grace" | "overdue";

export function standing(periodEndsAt: Date | null, now: Date, rules: RenewalRules): Standing {
    if (!periodEndsAt) return "undated";
    const t = now.getTime();
    const end = periodEndsAt.getTime();
    if (t < end - rules.reminderDays * DAY) return "current";
    if (t < end) return "dueSoon";
    if (t < readOnlyFrom(periodEndsAt, rules).getTime()) return "grace";
    return "overdue";
}

export type TickInput = {
    tenantStatus: TenantStatus;
    periodEndsAt: Date | null;
    remindedFor: Date | null;
    overdueNoticeFor: Date | null;
};

export type TickDecision = { remind: boolean; markPastDue: boolean };

const same = (a: Date | null, b: Date) => a !== null && a.getTime() === b.getTime();

/**
 * What the daily run should do for one subscription.
 *
 * Every decision is keyed to the period it is about, so running twice in a day
 * — or after a missed day — sends nothing twice and skips nothing. Only a
 * workshop that is `ACTIVE` is moved: one already `PAST_DUE` has been told, and
 * one `SUSPENDED` or `CANCELLED` was put there by a person, which the clock
 * does not overrule.
 */
export function decideTick(input: TickInput, now: Date, rules: RenewalRules): TickDecision {
    const { periodEndsAt } = input;
    if (!periodEndsAt || input.tenantStatus !== "ACTIVE") return { remind: false, markPastDue: false };

    const s = standing(periodEndsAt, now, rules);
    const markPastDue = s === "overdue" && !same(input.overdueNoticeFor, periodEndsAt);
    // A reminder that was missed — a server down for the week, a period set in
    // the past by hand — is still sent once the period is due, unless the
    // read-only notice is about to say the same thing more firmly.
    const remind = (s === "dueSoon" || s === "grace") && !same(input.remindedFor, periodEndsAt);
    return { remind, markPastDue };
}

/**
 * Where the period bought by a renewal begins.
 *
 * A workshop still `ACTIVE` — paid early, on time, or within grace — continues
 * from where it was paid up to, so paying a few days late every month does not
 * slowly turn into a free week. One that was `PAST_DUE` or `SUSPENDED` had
 * reduced access or none, and is not billed for that time: its new period
 * starts the day the payment is confirmed.
 */
export function renewalStart(tenantStatus: TenantStatus, periodEndsAt: Date | null, now: Date): Date {
    if (!periodEndsAt) return now;
    if (tenantStatus === "ACTIVE") return periodEndsAt;
    return periodEndsAt.getTime() > now.getTime() ? periodEndsAt : now;
}

/**
 * MOTION bills from Windhoek, so a billing date is a Windhoek date.
 *
 * Written out ("7 November 2026") rather than as 07/11/2026, because a
 * renewal letter is read by people who write dates both ways round, and the
 * day somebody is locked into read-only is not the place to be ambiguous.
 */
export const BILLING_TIME_ZONE = "Africa/Windhoek";

export function billingDay(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: BILLING_TIME_ZONE });
}

/** A `yyyy-mm-dd` typed by staff, as the start of that day in Windhoek. Null if it is not a real date. */
export function billingDateFromInput(value: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const d = new Date(`${value}T00:00:00+02:00`);
    if (Number.isNaN(d.getTime())) return null;
    // Rejects 2026-02-31, which Date would otherwise roll into March.
    return billingInputValue(d) === value ? d : null;
}

/** The inverse, for an `<input type="date">` default. */
export function billingInputValue(d: Date): string {
    return d.toLocaleDateString("en-CA", { timeZone: BILLING_TIME_ZONE });
}

/** How long after one payment another for the same workshop is treated as a repeat click. */
export const REPEAT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Why a renewal should not be recorded right now — or null if it may be.
 *
 * Two mistakes this catches, both of which happened: pressing "Payment
 * received" again because nothing seemed to change, and recording a renewal
 * for a workshop that is paid up for weeks yet, when what was meant was a
 * payment already counted. A real early payment is still possible — from the
 * workshop's own page, which says exactly which period it buys (`early`).
 */
export function renewalRefusal(input: {
    workshopName: string;
    tenantStatus: TenantStatus;
    periodEndsAt: Date;
    early: boolean;
    lastPayment: { confirmedAt: Date; invoiceNumber: string | null } | null;
    now: Date;
    rules: RenewalRules;
}): string | null {
    const { workshopName: name, lastPayment, now } = input;
    if (lastPayment) {
        const ago = now.getTime() - lastPayment.confirmedAt.getTime();
        if (ago >= 0 && ago < REPEAT_WINDOW_MS) {
            const when = ago < 60_000 ? "moments" : `${Math.round(ago / 60_000)} minutes`;
            return `A payment was recorded for ${name} ${when} ago${lastPayment.invoiceNumber ? ` (${lastPayment.invoiceNumber})` : ""}, so this was not recorded again. If a second payment really did arrive, record it again in a few minutes.`;
        }
    }
    if (!input.early && input.tenantStatus === "ACTIVE" && standing(input.periodEndsAt, now, input.rules) === "current") {
        return `${name} is paid up to ${billingDay(input.periodEndsAt)}, so nothing is due and nothing was recorded. A payment made early is recorded from the workshop's page.`;
    }
    return null;
}
