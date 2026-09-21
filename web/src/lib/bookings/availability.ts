import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { getDiary } from "@/lib/diary/queries";
import { availableSlots, isFull } from "@/lib/diary/capacity";
import { addDays, fromZoned, toZoned } from "@/lib/diary/time";
import { onlineBookingSettings } from "@/lib/settings/schema";

/**
 * What the public booking page may offer (R4). Built from the same diary the
 * front desk sees, so a customer is never offered a slot the diary shows
 * taken — and it returns times only, never whose car is booked in them.
 */

export type BookableDay = { day: string; open: boolean; full: boolean; slots: number[] };

/** Online requests that have not been decided still take up room, or two people are offered the same Friday. */
async function pendingMinutesByDay(db: TenantDb, tenant: Tenant, from: string, to: string): Promise<Map<string, number>> {
    const rows = await db.bookingRequest.findMany({
        where: { status: "PENDING", requestedAt: { gte: fromZoned(from, 0, tenant.timezone), lt: fromZoned(addDays(to, 1), 0, tenant.timezone) } },
        select: { requestedAt: true, minutes: true },
    });
    const out = new Map<string, number>();
    for (const r of rows) {
        const day = toZoned(r.requestedAt, tenant.timezone).day;
        out.set(day, (out.get(day) ?? 0) + r.minutes);
    }
    return out;
}

export async function bookableDays(db: TenantDb, tenant: Tenant, minutes: number, now = new Date()): Promise<BookableDay[]> {
    const online = onlineBookingSettings(tenant.settings);
    const here = toZoned(now, tenant.timezone);
    const from = addDays(here.day, online.leadDays);
    const to = addDays(here.day, online.horizonDays);

    const [diary, pending] = await Promise.all([getDiary(db, tenant, from, to), pendingMinutesByDay(db, tenant, from, to)]);

    return diary.days.map((d) => {
        const extra = pending.get(d.day) ?? 0;
        const booked = d.load.booked + extra;
        const percent = d.load.available > 0 ? Math.round((booked / d.load.available) * 100) : booked > 0 ? 100 : 0;
        const lanes = d.lanes.map((lane) => ({
            working: lane.working,
            off: lane.off,
            booked: d.bookings.filter((b) => b.mechanicId === lane.mechanicId).map((b) => ({ start: b.start, end: b.start + b.minutes })),
        }));
        // Same-day booking, when a workshop allows it, keeps an hour's warning.
        const notBefore = d.day === here.day ? here.minute + 60 : 0;
        const slots = d.open ? availableSlots(lanes, diary.settings, minutes, percent, notBefore) : [];
        return { day: d.day, open: d.open, full: d.open && isFull(percent, diary.settings), slots };
    });
}
