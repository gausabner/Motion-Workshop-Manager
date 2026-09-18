/**
 * How full the workshop is (R4). Pure, over minutes-since-midnight in the
 * workshop's own zone, so "the diary is full at 90%" is something the tests
 * check rather than something someone eyeballs on a busy Monday.
 */

export type Interval = { start: number; end: number };

export type DiarySettings = {
    opensAt: number;
    closesAt: number;
    slotMinutes: number;
    /** ISO weekdays the workshop opens: 1 = Monday. */
    workingDays: number[];
    fullAtPercent: number;
    lanesPerPage: number;
    defaultBookingMinutes: number;
};

export const DEFAULT_DIARY: DiarySettings = {
    opensAt: 7 * 60 + 30,
    closesAt: 17 * 60,
    slotMinutes: 30,
    workingDays: [1, 2, 3, 4, 5],
    fullAtPercent: 90,
    lanesPerPage: 4,
    defaultBookingMinutes: 60,
};

/** A mechanic's own hours for a weekday, when they differ from the shop's. Equal start and end means a day off. */
export type HoursOverride = { weekday: number; startMinute: number; endMinute: number };

export function workingInterval(weekday: number, settings: DiarySettings, override?: HoursOverride): Interval | null {
    if (override) return override.endMinute > override.startMinute ? { start: override.startMinute, end: override.endMinute } : null;
    return settings.workingDays.includes(weekday) ? { start: settings.opensAt, end: settings.closesAt } : null;
}

/** Merge overlapping intervals so time off is never subtracted twice. */
export function union(intervals: Interval[]): Interval[] {
    const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
    const out: Interval[] = [];
    for (const i of sorted) {
        const last = out[out.length - 1];
        if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
        else out.push({ ...i });
    }
    return out;
}

export function overlapMinutes(a: Interval, b: Interval): number {
    return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/** Working time left once leave, a doctor's visit or a training morning is taken out. */
export function availableMinutes(working: Interval | null, off: Interval[]): number {
    if (!working) return 0;
    const taken = union(off).reduce((sum, o) => sum + overlapMinutes(working, o), 0);
    return Math.max(0, working.end - working.start - taken);
}

export type MechanicDay = { mechanicId: string; working: Interval | null; off: Interval[] };
export type Booked = { id: string; mechanicId: string | null; start: number; minutes: number };

export type Load = { available: number; booked: number; percent: number };

function load(available: number, booked: number): Load {
    const percent = available > 0 ? Math.round((booked / available) * 100) : booked > 0 ? 100 : 0;
    return { available, booked, percent };
}

/**
 * The day's load, whole-shop and per mechanic.
 *
 * An unassigned booking still needs somebody, so it counts against the shop
 * total even though it sits in nobody's lane — otherwise a diary full of
 * unassigned work reads as empty.
 */
export function dayLoad(mechanics: MechanicDay[], bookings: Booked[]): { shop: Load; byMechanic: Record<string, Load> } {
    const byMechanic: Record<string, Load> = {};
    let available = 0;
    for (const m of mechanics) {
        const minutes = availableMinutes(m.working, m.off);
        available += minutes;
        const mine = bookings.filter((b) => b.mechanicId === m.mechanicId).reduce((sum, b) => sum + b.minutes, 0);
        byMechanic[m.mechanicId] = load(minutes, mine);
    }
    const booked = bookings.reduce((sum, b) => sum + b.minutes, 0);
    return { shop: load(available, booked), byMechanic };
}

export function isFull(percent: number, settings: Pick<DiarySettings, "fullAtPercent">): boolean {
    return percent >= settings.fullAtPercent;
}

/** Bookings in one lane that clash with another — shown, never silently prevented, because workshops double up on purpose. */
export function clashes(bookings: Booked[]): Set<string> {
    const out = new Set<string>();
    const sorted = [...bookings].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].start + sorted[i].minutes; j += 1) {
            out.add(sorted[i].id);
            out.add(sorted[j].id);
        }
    }
    return out;
}

/** Where a drop lands: snapped to the slot, and kept inside the day. */
export function snapMinute(minute: number, settings: Pick<DiarySettings, "slotMinutes">, bounds: Interval): number {
    const snapped = Math.round(minute / settings.slotMinutes) * settings.slotMinutes;
    return Math.min(Math.max(snapped, bounds.start), Math.max(bounds.start, bounds.end - settings.slotMinutes));
}

/**
 * How the columns lay side by side when bookings overlap in one lane, so a
 * double-booking is visible as two blocks rather than one hiding the other.
 */
export function lanesWithin(bookings: Booked[]): Record<string, { column: number; columns: number }> {
    const sorted = [...bookings].sort((a, b) => a.start - b.start || b.minutes - a.minutes);
    const out: Record<string, { column: number; columns: number }> = {};
    let group: Booked[] = [];
    let groupEnd = -1;
    const columnEnds: number[] = [];

    const flush = () => {
        const columns = Math.max(1, ...group.map((b) => out[b.id].column + 1));
        for (const b of group) out[b.id].columns = columns;
        group = [];
        columnEnds.length = 0;
    };

    for (const b of sorted) {
        if (group.length && b.start >= groupEnd) flush();
        let column = columnEnds.findIndex((end) => end <= b.start);
        if (column === -1) column = columnEnds.length;
        columnEnds[column] = b.start + b.minutes;
        out[b.id] = { column, columns: 1 };
        group.push(b);
        groupEnd = Math.max(groupEnd, b.start + b.minutes);
    }
    if (group.length) flush();
    return out;
}
