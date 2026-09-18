/**
 * Wall-clock time in the workshop's own timezone (R4).
 *
 * A booking at 09:00 means 09:00 in Windhoek whatever the server or the
 * browser thinks the time is. Parsing a `datetime-local` value with
 * `new Date()` reads it in the *server's* zone and formatting it reads it in
 * the *browser's* — fine on a laptop in Windhoek, two hours out on a UTC
 * server. Everything the diary positions goes through here instead.
 *
 * No library: `Intl` knows every zone, and the one subtle part — a clock that
 * jumps for daylight saving — is handled by correcting the offset twice.
 */

export type ZonedParts = {
    /** YYYY-MM-DD in the zone. */
    day: string;
    /** Minutes since that day's midnight in the zone. */
    minute: number;
    /** ISO weekday, 1 = Monday … 7 = Sunday. */
    weekday: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
    let f = formatters.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
            timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
        });
        formatters.set(timeZone, f);
    }
    return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function parts(at: Date, timeZone: string) {
    const out: Record<string, string> = {};
    for (const p of formatter(timeZone).formatToParts(at)) out[p.type] = p.value;
    return {
        year: Number(out.year), month: Number(out.month), day: Number(out.day),
        hour: Number(out.hour), minute: Number(out.minute), second: Number(out.second),
        weekday: WEEKDAYS[out.weekday] ?? 1,
    };
}

/** How far the zone is ahead of UTC at that instant, in minutes. */
export function offsetMinutes(at: Date, timeZone: string): number {
    const p = parts(at, timeZone);
    const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asIfUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

export function toZoned(at: Date, timeZone: string): ZonedParts {
    const p = parts(at, timeZone);
    const pad = (n: number) => String(n).padStart(2, "0");
    return { day: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minute: p.hour * 60 + p.minute, weekday: p.weekday };
}

/** The instant a wall-clock time in the zone refers to. */
export function fromZoned(day: string, minute: number, timeZone: string): Date {
    const [y, m, d] = day.split("-").map(Number);
    const naive = Date.UTC(y, m - 1, d, 0, minute);
    // Two passes: the offset at the naive guess can differ from the offset at
    // the answer when a daylight-saving change falls between them.
    let guess = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
    guess = naive - offsetMinutes(new Date(guess), timeZone) * 60_000;
    return new Date(guess);
}

/** `<input type="datetime-local">` value → instant, read in the workshop's zone. */
export function parseLocalDateTime(value: string, timeZone: string): Date | null {
    const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
    if (!match) return null;
    const [, day, hh, mm] = match;
    const hours = Number(hh);
    const minutes = Number(mm);
    if (hours > 23 || minutes > 59) return null;
    return fromZoned(day, hours * 60 + minutes, timeZone);
}

/** Instant → `<input type="datetime-local">` value, shown in the workshop's zone. */
export function formatLocalDateTime(at: Date | null | undefined, timeZone: string): string {
    if (!at) return "";
    const z = toZoned(at, timeZone);
    return `${z.day}T${minuteLabel(z.minute)}`;
}

/** 450 → "07:30". */
export function minuteLabel(minute: number): string {
    const h = Math.floor(minute / 60);
    const m = minute % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "07:30" → 450; null if it is not a time. */
export function parseMinute(value: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
    return h * 60 + m;
}

/** Calendar arithmetic on YYYY-MM-DD strings, which have no zone to get wrong. */
export function addDays(day: string, days: number): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(day: string): number {
    const [y, m, d] = day.split("-").map(Number);
    const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return js === 0 ? 7 : js;
}

/** The Monday on or before the day. */
export function startOfWeek(day: string): string {
    return addDays(day, 1 - weekdayOf(day));
}

export function startOfMonth(day: string): string {
    return `${day.slice(0, 7)}-01`;
}

export function daysInMonth(day: string): number {
    const [y, m] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
