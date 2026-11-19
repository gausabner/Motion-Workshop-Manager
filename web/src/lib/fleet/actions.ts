"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { JobSignRole, JobSignStage, VisitPurpose } from "@prisma/client";
import { requireFeature } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { str, type ActionState } from "@/lib/forms";
import { JOB_SIGN_ROLES, jobFlowSettingsSchema, parseSettings } from "@/lib/settings/schema";
import { acceptVisit, bookIn, sendOn, signJob } from "@/lib/fleet/route";

/**
 * Moving a vehicle along its route, and signing its job card. Council plan
 * only. Who may do each is decided by designation and appointment inside the
 * service, not by role here: reception books in and records the driver, the
 * people at a place send it on and accept it, the check bay signs its checks.
 */

async function onSite(slug: string) {
    const ctx = await requireFeature(slug, "jobFlow");
    return { ...ctx, actor: { membershipId: ctx.membership.id, userId: ctx.user.id } };
}

function refresh(slug: string, documentId: string) {
    revalidatePath(`/${slug}/dashboard/documents/${documentId}`);
    revalidatePath(`/${slug}/dashboard/flow`);
}

async function attempt(fn: () => Promise<unknown>, done: string): Promise<ActionState> {
    try {
        await fn();
        return { ok: true, message: done };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not done. Try again." };
    }
}

export async function bookInAction(slug: string, documentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, actor } = await onSite(slug);
    const result = await attempt(() => db.$transaction((tx) => bookIn(tx, tenant, actor, documentId, str(formData, "workshopId") ?? "", str(formData, "note"))), "Booked in");
    refresh(slug, documentId);
    return result;
}

export async function sendOnAction(slug: string, documentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, actor } = await onSite(slug);
    // The destination is chosen as "PURPOSE:workshopId", so one list can offer the tyre bay for work and the check bay for its quality check.
    const [purpose, workshopId] = (str(formData, "to") ?? "").split(":");
    const parsed = z.enum(VisitPurpose).safeParse(purpose);
    if (!parsed.success || !workshopId) return { ok: false, message: "Choose where it goes." };
    const result = await attempt(() => db.$transaction((tx) => sendOn(tx, tenant, actor, documentId, { purpose: parsed.data, workshopId, note: str(formData, "note") })), "Sent");
    refresh(slug, documentId);
    return result;
}

export async function acceptAction(slug: string, documentId: string, visitId: string): Promise<ActionState> {
    const { db, tenant, actor } = await onSite(slug);
    const result = await attempt(() => db.$transaction((tx) => acceptVisit(tx, tenant, actor, visitId)), "Accepted");
    refresh(slug, documentId);
    return result;
}

export async function signJobAction(slug: string, documentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, actor } = await onSite(slug);
    const stage = z.enum(JobSignStage).safeParse(str(formData, "stage"));
    const role = z.enum(JobSignRole).safeParse(str(formData, "role"));
    if (!stage.success || !role.success) return { ok: false, message: "Choose what you are signing." };
    const decision = str(formData, "decision");
    const result = await attempt(
        () => db.$transaction((tx) => signJob(tx, tenant, actor, documentId, {
            stage: stage.data,
            role: role.data,
            decision: decision === "PASSED" || decision === "FAILED" ? decision : undefined,
            driver: role.data === "DRIVER" ? { name: str(formData, "driverName") ?? "", payNumber: str(formData, "driverPayNumber") ?? null } : null,
            comment: str(formData, "comment"),
        })),
        "Signed",
    );
    refresh(slug, documentId);
    return result;
}

/** Which signatures the council's paper job card asks for at issue. Settings work, so the settings permission. */
export async function saveJobCardSignatures(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user, membership } = await requireFeature(slug, "jobFlow");
    assertCan(membership, "settings:manage");
    const chosen = formData.getAll("issueRoles").map(String).filter((r): r is (typeof JOB_SIGN_ROLES)[number] => (JOB_SIGN_ROLES as readonly string[]).includes(r));
    const parsed = jobFlowSettingsSchema.safeParse({ issueRoles: chosen });
    if (!parsed.success) return { ok: false, message: "Tick at least one signature." };
    const settings = parseSettings(tenant.settings);
    await db.tenant.update({ where: { id: tenant.id }, data: { settings: { ...settings, jobFlow: parsed.data } } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Tenant", entityId: tenant.id, action: "UPDATED", diff: { section: "jobFlow", ...parsed.data } } });
    revalidatePath(`/${slug}/dashboard/settings/workshops`);
    return { ok: true, message: "Saved" };
}
