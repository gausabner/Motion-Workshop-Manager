"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { type ActionState, bool, str } from "@/lib/forms";
import { parseSettings, reminderSettingsSchema } from "@/lib/settings/schema";

const KINDS = ["SERVICE_DUE", "LICENCE_DISC", "ROADWORTHY", "BOOKING", "QUOTE_FOLLOW_UP"] as const;
const keySchema = z.object({ kind: z.enum(KINDS), targetId: z.string().min(1).max(40), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

function refresh(slug: string) {
    revalidatePath(`/${slug}/dashboard/reminders`);
    revalidatePath(`/${slug}/dashboard`);
}

/** Not this one — the customer already booked, sold the car, or asked not to be chased. */
export async function skipReminderAction(slug: string, input: z.input<typeof keySchema>): Promise<void> {
    const { db, tenant, membership } = await requireTenant(slug);
    assertCan(membership, "messages:send");
    const key = keySchema.parse(input);
    const dueOn = new Date(`${key.dueOn}T00:00:00Z`);
    // Only something that exists in this workshop can be skipped.
    const isVehicle = key.kind === "SERVICE_DUE" || key.kind === "LICENCE_DISC" || key.kind === "ROADWORTHY";
    const owner = isVehicle
        ? await db.vehicle.findUnique({ where: { id: key.targetId }, select: { id: true, customerId: true } })
        : await db.document.findUnique({ where: { id: key.targetId }, select: { id: true, customerId: true } });
    if (!owner) return;
    await db.reminder.upsert({
        where: { tenantId_kind_targetId_dueOn: { tenantId: tenant.id, kind: key.kind, targetId: key.targetId, dueOn } },
        create: {
            tenantId: tenant.id, kind: key.kind, targetId: key.targetId, dueOn, outcome: "SKIPPED", customerId: owner.customerId,
            vehicleId: isVehicle ? owner.id : null, documentId: isVehicle ? null : owner.id, actedById: membership.id,
        },
        update: {},
    });
    refresh(slug);
}

/** Put a skipped reminder back on the list. A sent one stays sent: the message went. */
export async function unskipReminderAction(slug: string, reminderId: string): Promise<void> {
    const { db, membership } = await requireTenant(slug);
    assertCan(membership, "messages:send");
    await db.reminder.deleteMany({ where: { id: reminderId, outcome: "SKIPPED" } });
    refresh(slug);
}

export async function saveReminderSettings(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user, membership } = await requireTenant(slug);
    assertCan(membership, "settings:manage");
    const rule = (name: string) => ({ enabled: bool(formData, `${name}.enabled`), days: Number(str(formData, `${name}.days`) ?? 0) });
    const parsed = reminderSettingsSchema.safeParse({
        service: rule("service"), licence: rule("licence"), roadworthy: rule("roadworthy"), booking: rule("booking"), quote: rule("quote"),
    });
    if (!parsed.success) return { ok: false, message: "Days must be whole numbers: up to 60 ahead for vehicles, 7 for bookings, 30 for quotes." };
    await db.tenant.update({ where: { id: tenant.id }, data: { settings: { ...parseSettings(tenant.settings), reminders: parsed.data } } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Tenant", entityId: tenant.id, action: "UPDATED", diff: { section: "reminders", ...parsed.data } } });
    revalidatePath(`/${slug}/dashboard/settings/messaging`);
    refresh(slug);
    return { ok: true, message: "Saved" };
}
