import type { ReminderKind } from "@prisma/client";
import type { ReminderSettings } from "@/lib/settings/schema";
import { addDays } from "@/lib/diary/time";

/**
 * When each reminder is due, as calendar days in the workshop's own zone.
 * Pure, so the windows are tested without a clock or a database.
 *
 * A reminder is keyed by the date it is *for* — the service date, the disc
 * expiry, the booking day, the day a quote follow-up falls. Sending or skipping
 * it records that key; change the date and there is a new reminder to send.
 */

/** How long an overdue date keeps showing before it is treated as stale. */
export const OVERDUE_DAYS = 30;

export const KIND_ORDER: ReminderKind[] = ["BOOKING", "SERVICE_DUE", "LICENCE_DISC", "ROADWORTHY", "QUOTE_FOLLOW_UP"];

export const KIND_LABELS: Record<ReminderKind, string> = {
    BOOKING: "Bookings coming up",
    SERVICE_DUE: "Services due",
    LICENCE_DISC: "Licence discs expiring",
    ROADWORTHY: "Roadworthies expiring",
    QUOTE_FOLLOW_UP: "Quotes to follow up",
};

/** One of them, for the history list. */
export const KIND_NOUNS: Record<ReminderKind, string> = {
    BOOKING: "Booking reminder",
    SERVICE_DUE: "Service reminder",
    LICENCE_DISC: "Licence disc reminder",
    ROADWORTHY: "Roadworthy reminder",
    QUOTE_FOLLOW_UP: "Quote follow-up",
};

const SETTING: Record<ReminderKind, keyof ReminderSettings> = {
    SERVICE_DUE: "service", LICENCE_DISC: "licence", ROADWORTHY: "roadworthy", BOOKING: "booking", QUOTE_FOLLOW_UP: "quote",
};

export type Window = { from: string; to: string };

/**
 * The range the *key date* must fall in for a reminder to be on today's list,
 * or null when the workshop has that reminder switched off.
 *
 * - Vehicle dates (service, disc, roadworthy): from a month overdue up to `days` ahead.
 * - Bookings: today up to `days` ahead — a booking in the past has had its chance.
 * - Quotes: the key is the day the quote was sent; it is due `days` later and
 *   stays on the list for a month after that.
 */
export function windowFor(kind: ReminderKind, today: string, settings: ReminderSettings): Window | null {
    const rule = settings[SETTING[kind]];
    if (!rule.enabled) return null;
    switch (kind) {
        case "BOOKING":
            return { from: today, to: addDays(today, rule.days) };
        case "QUOTE_FOLLOW_UP":
            return { from: addDays(today, -(rule.days + OVERDUE_DAYS)), to: addDays(today, -rule.days) };
        default:
            return { from: addDays(today, -OVERDUE_DAYS), to: addDays(today, rule.days) };
    }
}

export function inWindow(day: string, window: Window): boolean {
    return day >= window.from && day <= window.to;
}

/** For a quote the key is the day it was sent; the list shows the day the follow-up fell due. */
export function followUpDay(kind: ReminderKind, keyDay: string, settings: ReminderSettings): string {
    return kind === "QUOTE_FOLLOW_UP" ? addDays(keyDay, settings.quote.days) : keyDay;
}

/** "in 3 days", "today", "5 days ago" — what the list says about each date. */
export function relativeDay(day: string, today: string): string {
    const diff = Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff === -1) return "yesterday";
    return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

export function reminderKey(kind: ReminderKind, targetId: string, dueOn: string): string {
    return `${kind}:${targetId}:${dueOn}`;
}
