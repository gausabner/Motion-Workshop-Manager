"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { fromZod, str, type ActionState } from "@/lib/forms";
import { approveRequest, declineRequest } from "@/lib/bookings/approval";
import { z } from "zod";

function revalidate(slug: string) {
    revalidatePath(`/${slug}/dashboard/schedule`, "layout");
}

export async function approveBookingRequest(slug: string, requestId: string, mechanicId: string | null): Promise<{ ok: true; documentId: string; note: string | null } | { ok: false; message: string }> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    try {
        const result = await ctx.db.$transaction((tx) => approveRequest(tx, ctx.tenant, ctx.membership.id, requestId, { mechanicId }));
        await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "BookingRequest", entityId: requestId, action: "APPROVED", diff: { documentId: result.documentId, vehicle: result.vehicle, createdCustomer: result.createdCustomer } } });
        revalidate(slug);
        const note = result.vehicle === "conflict" ? "The plate is on file for another customer, so it was not attached — check it on the booking." : null;
        return { ok: true, documentId: result.documentId, note };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That did not work" };
    }
}

export async function declineBookingRequest(slug: string, requestId: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const why = reason.trim().slice(0, 200);
    if (!why) return { ok: false, message: "Give a reason — it is what you will tell the customer." };
    try {
        await ctx.db.$transaction((tx) => declineRequest(tx, ctx.membership.id, requestId, why));
        await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "BookingRequest", entityId: requestId, action: "DECLINED", diff: { reason: why } } });
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That did not work" };
    }
    revalidate(slug);
    return { ok: true };
}

const appointmentTypeSchema = z.object({
    description: z.string().trim().min(2, "Name the service").max(80),
    estimatedHours: z.coerce.number().min(0.25, "At least a quarter of an hour").max(24),
    active: z.boolean(),
});

/** One list of services for the counter and the public page alike. */
export async function saveAppointmentType(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");
    const parsed = appointmentTypeSchema.safeParse({
        description: str(formData, "description"),
        estimatedHours: str(formData, "estimatedHours"),
        active: formData.get("active") === "on",
    });
    if (!parsed.success) return fromZod(parsed.error);

    const clash = await ctx.db.appointmentType.findFirst({ where: { description: { equals: parsed.data.description, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) return { ok: false, errors: { description: ["There is already a service with that name"] } };

    if (id) {
        const updated = await ctx.db.appointmentType.updateMany({ where: { id }, data: parsed.data });
        if (!updated.count) return { ok: false, message: "That service is no longer there." };
    } else {
        const last = await ctx.db.appointmentType.aggregate({ _max: { sortOrder: true } });
        await ctx.db.appointmentType.create({ data: { tenantId: ctx.tenant.id, ...parsed.data, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
    }
    revalidatePath(`/${slug}/dashboard/settings/booking`);
    return { ok: true, message: id ? "Saved" : "Added" };
}
