"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { str, type ActionState } from "@/lib/forms";
import { parseLocalDateTime } from "@/lib/diary/time";
import { entryMinutes, isSuspect } from "@/lib/time/clock";
import { clockOff, clockOn } from "@/lib/time/clocking";

function revalidateJob(slug: string, documentId?: string) {
    revalidatePath(`/${slug}/pwa`);
    revalidatePath(`/${slug}/dashboard/jobs`);
    revalidatePath(`/${slug}/dashboard/schedule`, "layout");
    if (documentId) revalidatePath(`/${slug}/dashboard/documents/${documentId}`);
}

/** A mechanic clocks themselves on. Nobody clocks on for someone else from the floor app. */
export async function clockOnAction(slug: string, documentId: string): Promise<{ ok: boolean; message?: string }> {
    const ctx = await requireTenant(slug);
    try {
        const result = await ctx.db.$transaction((tx) => clockOn(tx, ctx.tenant.id, ctx.membership.id, documentId));
        if (result.stopped) revalidateJob(slug, result.stopped.documentId);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Could not clock on" };
    }
    revalidateJob(slug, documentId);
    return { ok: true };
}

export async function clockOffAction(slug: string): Promise<{ ok: boolean; message?: string }> {
    const ctx = await requireTenant(slug);
    const stopped = await ctx.db.$transaction((tx) => clockOff(tx, ctx.membership.id));
    revalidateJob(slug, stopped?.documentId);
    return { ok: true, message: stopped ? undefined : "Nothing was running" };
}

/**
 * Time added or corrected at the counter — the forgotten clock-off, the job
 * done before anyone opened the app. Marked MANUAL so it can be told apart.
 */
export async function addTimeEntry(slug: string, documentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const mechanicId = str(formData, "mechanicId");
    const startedAt = parseLocalDateTime(str(formData, "startedAt") ?? "", ctx.tenant.timezone);
    const endedAt = parseLocalDateTime(str(formData, "endedAt") ?? "", ctx.tenant.timezone);
    const note = str(formData, "note")?.slice(0, 200) ?? null;

    if (!mechanicId) return { ok: false, errors: { mechanicId: ["Who did the work?"] } };
    if (!startedAt) return { ok: false, errors: { startedAt: ["When did it start?"] } };
    if (!endedAt) return { ok: false, errors: { endedAt: ["When did it finish?"] } };
    if (endedAt <= startedAt) return { ok: false, errors: { endedAt: ["It has to finish after it starts"] } };
    const minutes = entryMinutes(startedAt, endedAt);
    if (isSuspect(minutes)) return { ok: false, errors: { endedAt: ["That is over ten hours on one job — check the times"] } };

    const [doc, mechanic] = await Promise.all([
        ctx.db.document.findUnique({ where: { id: documentId }, select: { type: true } }),
        ctx.db.membership.findUnique({ where: { id: mechanicId }, select: { id: true } }),
    ]);
    if (!doc || (doc.type !== "BOOKING" && doc.type !== "JOB_CARD")) return { ok: false, message: "Time goes on a booking or job card." };
    if (!mechanic) return { ok: false, errors: { mechanicId: ["That person is not in this workshop"] } };

    await ctx.db.timeEntry.create({ data: { tenantId: ctx.tenant.id, documentId, mechanicId, source: "MANUAL", startedAt, endedAt, minutes, note } });
    await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "TimeEntry", entityId: documentId, action: "CREATED", diff: { mechanicId, minutes, source: "MANUAL" } } });
    revalidateJob(slug, documentId);
    return { ok: true, message: "Added" };
}

export async function deleteTimeEntry(slug: string, entryId: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const entry = await ctx.db.timeEntry.findUnique({ where: { id: entryId }, select: { documentId: true, minutes: true, mechanicId: true } });
    if (!entry) return;
    await ctx.db.timeEntry.delete({ where: { id: entryId } });
    await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "TimeEntry", entityId: entryId, action: "DELETED", diff: { documentId: entry.documentId, mechanicId: entry.mechanicId, minutes: entry.minutes } } });
    revalidateJob(slug, entry.documentId);
}

/** Stop someone else's clock from the counter — the mechanic went home with it running. */
export async function stopClockFor(slug: string, membershipId: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const stopped = await ctx.db.$transaction((tx) => clockOff(tx, membershipId));
    revalidateJob(slug, stopped?.documentId);
}
