import "server-only";
import type { DocumentType, JobStatus, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { diarySettings } from "@/lib/settings/schema";
import { dayLoad, workingInterval, type DiarySettings, type Interval, type Load } from "@/lib/diary/capacity";
import { addDays, fromZoned, toZoned, weekdayOf } from "@/lib/diary/time";

/**
 * Everything the booking diary draws, for a run of days, in one pass (R4).
 * Times are minutes in the workshop's own zone; the components never touch a
 * Date, so the browser's clock cannot move a booking.
 */

export type DiaryBooking = {
    id: string;
    type: DocumentType;
    number: string | null;
    jobNumber: string | null;
    jobStatus: JobStatus | null;
    description: string | null;
    day: string;
    start: number;
    minutes: number;
    mechanicId: string | null;
    /** The mechanic it is assigned to is no longer on the diary, so it shows as unassigned. */
    orphaned: boolean;
    customer: string | null;
    plate: string | null;
    vehicle: string | null;
};

export type DiaryMechanic = { id: string; name: string; initials: string };

export type DiaryLane = { mechanicId: string; working: Interval | null; off: (Interval & { reason: string | null })[]; load: Load };

export type DiaryDay = { day: string; weekday: number; open: boolean; lanes: DiaryLane[]; load: Load; bookings: DiaryBooking[] };

export type Diary = { settings: DiarySettings; mechanics: DiaryMechanic[]; days: DiaryDay[]; from: string; to: string };

const JOB_TYPES: DocumentType[] = ["BOOKING", "JOB_CARD"];

/** The people who get a column: mechanics, and anyone the workshop has chosen to show. */
export async function diaryMechanics(db: TenantDb): Promise<DiaryMechanic[]> {
    const rows = await db.membership.findMany({
        where: { status: "ACTIVE", OR: [{ isMechanic: true }, { showOnDiary: true }] },
        select: { id: true, user: { select: { firstName: true, lastName: true } } },
        orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
    });
    return rows.map((m) => ({
        id: m.id,
        name: `${m.user.firstName} ${m.user.lastName}`.trim(),
        initials: `${m.user.firstName[0] ?? ""}${m.user.lastName[0] ?? ""}`.toUpperCase(),
    }));
}

/** Clip an absolute stretch of time to one diary day, in minutes. */
function clipToDay(day: string, startsAt: Date, endsAt: Date, timeZone: string): Interval | null {
    const dayStart = fromZoned(day, 0, timeZone);
    const dayEnd = fromZoned(addDays(day, 1), 0, timeZone);
    if (endsAt <= dayStart || startsAt >= dayEnd) return null;
    const start = startsAt <= dayStart ? 0 : toZoned(startsAt, timeZone).minute;
    const end = endsAt >= dayEnd ? 1440 : toZoned(endsAt, timeZone).minute;
    return end > start ? { start, end } : null;
}

export async function getDiary(db: TenantDb, tenant: Tenant, from: string, to: string): Promise<Diary> {
    const settings = diarySettings(tenant.settings);
    const zone = tenant.timezone;
    const rangeStart = fromZoned(from, 0, zone);
    const rangeEnd = fromZoned(addDays(to, 1), 0, zone);

    const mechanics = await diaryMechanics(db);
    const ids = mechanics.map((m) => m.id);

    const [overrides, timeOff, documents] = await Promise.all([
        db.workingHours.findMany({ where: { membershipId: { in: ids } }, select: { membershipId: true, weekday: true, startMinute: true, endMinute: true } }),
        db.timeOff.findMany({ where: { membershipId: { in: ids }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } }, select: { membershipId: true, startsAt: true, endsAt: true, reason: true } }),
        db.document.findMany({
            where: { type: { in: JOB_TYPES }, state: { not: "VOID" }, scheduledAt: { gte: rangeStart, lt: rangeEnd } },
            orderBy: { scheduledAt: "asc" },
            select: {
                id: true, type: true, number: true, jobNumber: true, jobStatus: true, description: true, scheduledAt: true, estimatedHours: true, mechanicId: true,
                customer: { select: { firstName: true, lastName: true } },
                vehicle: { select: { plate: true, make: true, model: true } },
            },
        }),
    ]);

    const onDiary = new Set(ids);
    const bookings: DiaryBooking[] = documents.map((d) => {
        const z = toZoned(d.scheduledAt!, zone);
        const orphaned = !!d.mechanicId && !onDiary.has(d.mechanicId);
        return {
            id: d.id,
            type: d.type,
            number: d.number,
            jobNumber: d.jobNumber,
            jobStatus: d.jobStatus,
            description: d.description,
            day: z.day,
            start: z.minute,
            minutes: d.estimatedHours ? Math.max(15, Math.round(d.estimatedHours.toNumber() * 60)) : settings.defaultBookingMinutes,
            mechanicId: orphaned ? null : d.mechanicId,
            orphaned,
            customer: d.customer ? `${d.customer.firstName} ${d.customer.lastName}`.trim() : null,
            plate: d.vehicle?.plate ?? null,
            vehicle: d.vehicle ? `${d.vehicle.make} ${d.vehicle.model}`.trim() : null,
        };
    });

    const days: DiaryDay[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
        const weekday = weekdayOf(day);
        const todays = bookings.filter((b) => b.day === day);
        const lanes = mechanics.map((m) => {
            const override = overrides.find((o) => o.membershipId === m.id && o.weekday === weekday);
            const off = timeOff
                .filter((t) => t.membershipId === m.id)
                .map((t) => {
                    const clipped = clipToDay(day, t.startsAt, t.endsAt, zone);
                    return clipped ? { ...clipped, reason: t.reason } : null;
                })
                .filter((o): o is Interval & { reason: string | null } => o !== null);
            return { mechanicId: m.id, working: workingInterval(weekday, settings, override), off };
        });
        const { shop, byMechanic } = dayLoad(lanes, todays.map((b) => ({ id: b.id, mechanicId: b.mechanicId, start: b.start, minutes: b.minutes })));
        days.push({
            day,
            weekday,
            open: settings.workingDays.includes(weekday) || lanes.some((l) => l.working),
            lanes: lanes.map((l) => ({ ...l, load: byMechanic[l.mechanicId] })),
            load: shop,
            bookings: todays,
        });
    }

    return { settings, mechanics, days, from, to };
}
