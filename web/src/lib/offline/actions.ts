"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { applyQueue } from "./sync";
import type { ClockEvent } from "./queue";

/**
 * The floor app hands over everything it could not send at the time. It is the
 * mechanic's own queue on their own phone, so it clocks nobody but themselves —
 * the same rule the live buttons follow.
 */
export async function syncClockQueue(slug: string, events: ClockEvent[]): Promise<{ ok: boolean; applied: number; alreadyIn: number; problems: { ref: string; reason: string }[] }> {
    const ctx = await requireTenant(slug);
    if (!Array.isArray(events) || events.length === 0) return { ok: true, applied: 0, alreadyIn: 0, problems: [] };
    // A phone that has been off for a week should not be able to hand over a thousand taps.
    const batch = events.slice(0, 200);

    const result = await applyQueue(ctx.db, ctx.tenant.id, ctx.membership.id, batch);
    revalidatePath(`/${slug}/pwa`);
    revalidatePath(`/${slug}/dashboard/jobs`);
    return { ok: true, ...result };
}
