"use server";

import { requestOrigin } from "@/lib/http/origin";
import { revalidatePath } from "next/cache";
import type { MessageChannel } from "@prisma/client";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { type ActionState } from "@/lib/forms";
import { draftMessage, sendMessage, type Draft, type SendOutcome, type SendTarget } from "@/lib/messaging/service";
import { editableTemplate } from "@/lib/templates/catalogue";

function pathsFor(slug: string, target: SendTarget): string[] {
    if (target.kind === "DOCUMENT") return [`/${slug}/dashboard/documents/${target.id}`, `/${slug}/dashboard/transactions`];
    if (target.kind === "PAYMENT") return [`/${slug}/dashboard/payments/${target.id}`];
    if (target.kind === "INSPECTION") return [`/${slug}/dashboard/inspections/${target.id}`];
    if (target.kind === "PORTAL") return [`/${slug}/dashboard/customers/${target.customerId}`];
    if (target.kind === "REMINDER") return [`/${slug}/dashboard/reminders`, `/${slug}/dashboard`];
    return [`/${slug}/dashboard/customers/${target.customerId}`, `/${slug}/dashboard/customers/${target.customerId}/statement`];
}

export async function draftMessageAction(slug: string, target: SendTarget, channel: MessageChannel): Promise<Draft | null> {
    const { db, tenant, membership } = await requireTenant(slug);
    assertCan(membership, "messages:send");
    return draftMessage(db, tenant, target, channel);
}

export async function sendMessageAction(
    slug: string,
    input: { target: SendTarget; channel: MessageChannel; recipient: string; subject?: string | null; body: string },
): Promise<SendOutcome> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "messages:send");
    const outcome = await sendMessage(ctx, await requestOrigin(), input);
    for (const path of pathsFor(slug, input.target)) revalidatePath(path);
    return outcome;
}

/** Withdraw a link that went to the wrong person. The message stays in the log; the document stops opening. */
export async function revokeShareLinkAction(slug: string, shareLinkId: string): Promise<void> {
    const { db, tenant, user, membership } = await requireTenant(slug);
    assertCan(membership, "messages:send");
    const updated = await db.shareLink.updateMany({ where: { id: shareLinkId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (updated.count) {
        await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "ShareLink", entityId: shareLinkId, action: "REVOKED" } });
    }
    revalidatePath(`/${slug}/dashboard`, "layout");
}

/**
 * Reword a template. Any kind in the catalogue, messages and printed footers
 * alike: the row overrides the built-in wording, and resetting deletes the row.
 */
export async function saveTemplate(slug: string, kind: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user, membership } = await requireTenant(slug);
    assertCan(membership, "settings:manage");
    const template = editableTemplate(kind);
    if (!template) return { ok: false, message: "Unknown template." };

    const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
    if (!body && !template.allowEmpty) return { ok: false, errors: { body: ["A message cannot be empty. Reset it to use the standard wording."] } };
    if (body.length > 1500) return { ok: false, errors: { body: ["Keep it under 1,500 characters."] } };

    const existing = await db.template.findFirst({ where: { kind: template.kind }, orderBy: { sortOrder: "asc" }, select: { id: true } });
    if (existing) await db.template.update({ where: { id: existing.id }, data: { body, active: true } });
    else await db.template.create({ data: { tenantId: tenant.id, kind: template.kind, name: "Default", body } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Template", entityId: template.kind, action: "UPDATED" } });

    revalidatePath(`/${slug}/dashboard/settings/messaging`);
    return { ok: true, message: "Saved" };
}

/** Back to the built-in wording, which then follows any improvement we make to it. */
export async function resetTemplate(slug: string, kind: string): Promise<void> {
    const { db, tenant, user, membership } = await requireTenant(slug);
    assertCan(membership, "settings:manage");
    const template = editableTemplate(kind);
    if (!template) return;
    await db.template.deleteMany({ where: { kind: template.kind } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Template", entityId: template.kind, action: "RESET" } });
    revalidatePath(`/${slug}/dashboard/settings/messaging`);
}
