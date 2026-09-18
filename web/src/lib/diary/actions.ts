"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { createDocument } from "@/lib/documents/actions";
import { fromZoned, minuteLabel, parseLocalDateTime, parseMinute } from "@/lib/diary/time";
import { moveBooking, type Move } from "@/lib/diary/scheduling";
import { diarySettings, diarySettingsSchema, parseSettings } from "@/lib/settings/schema";
import { fromZod, str, type ActionState } from "@/lib/forms";

function revalidateDiary(slug: string) {
    revalidatePath(`/${slug}/dashboard/schedule`, "layout");
    revalidatePath(`/${slug}/dashboard/jobs`);
}

/** Drag and drop in the diary. Returns a message instead of throwing, so a refused drop snaps back with a reason. */
export async function moveBookingAction(slug: string, move: Move): Promise<{ ok: true } | { ok: false; message: string }> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    try {
        const change = await ctx.db.$transaction((tx) => moveBooking(tx, ctx.tenant, move));
        await ctx.db.auditEvent.create({
            data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "Document", entityId: move.documentId, action: "RESCHEDULED", diff: { ...change, mechanicId: move.mechanicId } },
        });
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That move did not work" };
    }
    revalidateDiary(slug);
    revalidatePath(`/${slug}/dashboard/documents/${move.documentId}`);
    return { ok: true };
}

/** Clicking an empty slot: a new booking already in that slot, for that mechanic. */
export async function bookSlotAction(slug: string, slot: { day: string; minute: number; mechanicId: string | null }): Promise<void> {
    const { tenant } = await requireTenant(slug);
    const settings = diarySettings(tenant.settings);
    await createDocument(slug, "BOOKING", {
        scheduledAt: `${slot.day}T${minuteLabel(slot.minute)}`,
        mechanicId: slot.mechanicId ?? undefined,
        estimatedHours: settings.defaultBookingMinutes / 60,
    });
}

export async function saveDiarySettings(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");

    const parsed = diarySettingsSchema.safeParse({
        opensAt: str(formData, "opensAt"),
        closesAt: str(formData, "closesAt"),
        slotMinutes: Number(str(formData, "slotMinutes") ?? 30),
        workingDays: formData.getAll("workingDays").map(Number),
        fullAtPercent: Number(str(formData, "fullAtPercent") ?? 90),
        lanesPerPage: Number(str(formData, "lanesPerPage") ?? 4),
        defaultBookingHours: Number(str(formData, "defaultBookingHours") ?? 1),
        onlineBooking: formData.get("onlineBooking") === "on",
        bookingLeadDays: Number(str(formData, "bookingLeadDays") ?? 1),
        bookingHorizonDays: Number(str(formData, "bookingHorizonDays") ?? 30),
    });
    if (!parsed.success) return fromZod(parsed.error);
    const opens = parseMinute(parsed.data.opensAt)!;
    const closes = parseMinute(parsed.data.closesAt)!;
    if (closes <= opens) return { ok: false, errors: { closesAt: ["Closing has to be after opening"] } };

    const settings = parseSettings(ctx.tenant.settings);
    await ctx.db.tenant.update({ where: { id: ctx.tenant.id }, data: { settings: { ...settings, diary: parsed.data } } });
    await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "Tenant", entityId: ctx.tenant.id, action: "UPDATED", diff: { section: "diary", ...parsed.data } } });
    revalidatePath(`/${slug}/dashboard/settings/booking`);
    revalidateDiary(slug);
    return { ok: true, message: "Saved" };
}

/**
 * One mechanic's hours on one weekday. "shop" removes the override so they
 * follow the shop's hours again; "off" records a regular day off.
 */
export async function saveWorkingDay(slug: string, input: { membershipId: string; weekday: number; mode: "shop" | "off" | "custom"; start?: string; end?: string }): Promise<{ ok: boolean; message?: string }> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");
    if (!Number.isInteger(input.weekday) || input.weekday < 1 || input.weekday > 7) return { ok: false, message: "That is not a weekday" };
    const member = await ctx.db.membership.findUnique({ where: { id: input.membershipId }, select: { id: true } });
    if (!member) return { ok: false, message: "That person is not in this workshop" };

    const key = { membershipId_weekday: { membershipId: input.membershipId, weekday: input.weekday } };
    if (input.mode === "shop") {
        await ctx.db.workingHours.deleteMany({ where: { membershipId: input.membershipId, weekday: input.weekday } });
    } else {
        const start = input.mode === "off" ? 0 : parseMinute(input.start ?? "");
        const end = input.mode === "off" ? 0 : parseMinute(input.end ?? "");
        if (start === null || end === null) return { ok: false, message: "Use times like 07:30" };
        if (input.mode === "custom" && end <= start) return { ok: false, message: "Finishing has to be after starting" };
        await ctx.db.workingHours.upsert({
            where: key,
            create: { tenantId: ctx.tenant.id, membershipId: input.membershipId, weekday: input.weekday, startMinute: start, endMinute: end },
            update: { startMinute: start, endMinute: end },
        });
    }
    revalidatePath(`/${slug}/dashboard/schedule/hours`);
    revalidateDiary(slug);
    return { ok: true };
}

/** Leave, a course, an appointment. Advisors run the diary day to day, so they can record it. */
export async function addTimeOff(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const membershipId = str(formData, "membershipId");
    const startsAt = parseLocalDateTime(str(formData, "startsAt") ?? "", ctx.tenant.timezone);
    const endsAt = parseLocalDateTime(str(formData, "endsAt") ?? "", ctx.tenant.timezone);
    const reason = str(formData, "reason")?.slice(0, 120) ?? null;

    if (!membershipId) return { ok: false, errors: { membershipId: ["Choose who is away"] } };
    if (!startsAt) return { ok: false, errors: { startsAt: ["When does it start?"] } };
    if (!endsAt) return { ok: false, errors: { endsAt: ["When does it end?"] } };
    if (endsAt <= startsAt) return { ok: false, errors: { endsAt: ["It has to end after it starts"] } };
    const member = await ctx.db.membership.findUnique({ where: { id: membershipId }, select: { id: true } });
    if (!member) return { ok: false, errors: { membershipId: ["That person is not in this workshop"] } };

    await ctx.db.timeOff.create({ data: { tenantId: ctx.tenant.id, membershipId, startsAt, endsAt, reason, createdById: ctx.membership.id } });
    revalidatePath(`/${slug}/dashboard/schedule/hours`);
    revalidateDiary(slug);
    return { ok: true, message: "Added" };
}

export async function removeTimeOff(slug: string, id: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    await ctx.db.timeOff.deleteMany({ where: { id } });
    revalidatePath(`/${slug}/dashboard/schedule/hours`);
    revalidateDiary(slug);
}

/** A whole day off in one click, from the diary itself. */
export async function markDayOff(slug: string, input: { membershipId: string; day: string; reason?: string }): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return;
    const member = await ctx.db.membership.findUnique({ where: { id: input.membershipId }, select: { id: true } });
    if (!member) return;
    const zone = ctx.tenant.timezone;
    const [y, m, d] = input.day.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    await ctx.db.timeOff.create({
        data: { tenantId: ctx.tenant.id, membershipId: input.membershipId, startsAt: fromZoned(input.day, 0, zone), endsAt: fromZoned(next, 0, zone), reason: input.reason ?? "Day off", createdById: ctx.membership.id },
    });
    revalidateDiary(slug);
}
