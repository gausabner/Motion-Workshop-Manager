"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { JobSignRole, JobSignStage, VisitPurpose } from "@prisma/client";
import { requireFeature } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { str, type ActionState } from "@/lib/forms";
import { JOB_SIGN_ROLES, jobFlowSettings, jobFlowSettingsSchema, parseSettings, type JobFlowSettings } from "@/lib/settings/schema";
import { acceptVisit, bookIn, sendOn, signJob } from "@/lib/fleet/route";
import { routeView, type MoveState } from "@/lib/fleet/queries";
import { startCheck } from "@/lib/fleet/check-bay";

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

/*
 * Each move answers with the job's route as it stands afterwards, and the
 * panel shows that, rather than waiting for the page to be fetched again. It
 * keeps the job card's unsaved edits and is one round trip instead of two.
 *
 * It began as a way round a bug: on Next 16.1.6 a production build sometimes
 * never showed the page a revalidating action fetched, and the button sat on
 * "Booking in…" with the work saved. That was the React that Next 16.1.6
 * ships, and Next 16.4.6 fixed it (see e2e/saving-comes-back.spec.ts).
 */
async function move(slug: string, documentId: string, done: string, run: (ctx: Awaited<ReturnType<typeof onSite>>) => Promise<unknown>): Promise<MoveState> {
    const ctx = await onSite(slug);
    try {
        await run(ctx);
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not done. Try again." };
    }
    return { ok: true, message: done, route: await routeView(ctx.db, ctx.tenant, documentId, ctx.membership.id) };
}

export async function bookInAction(slug: string, documentId: string, _prev: MoveState, formData: FormData): Promise<MoveState> {
    return move(slug, documentId, "Booked in", ({ db, tenant, actor }) =>
        db.$transaction((tx) => bookIn(tx, tenant, actor, documentId, str(formData, "workshopId") ?? "", str(formData, "note"))),
    );
}

export async function sendOnAction(slug: string, documentId: string, _prev: MoveState, formData: FormData): Promise<MoveState> {
    // The destination is chosen as "PURPOSE:workshopId", so one list can offer the tyre bay for work and the check bay for its quality check.
    const [purpose, workshopId] = (str(formData, "to") ?? "").split(":");
    const parsed = z.enum(VisitPurpose).safeParse(purpose);
    if (!parsed.success || !workshopId) return { ok: false, message: "Choose where it goes." };
    return move(slug, documentId, "Sent", ({ db, tenant, actor }) =>
        db.$transaction((tx) => sendOn(tx, tenant, actor, documentId, { purpose: parsed.data, workshopId, note: str(formData, "note") })),
    );
}

export async function acceptAction(slug: string, documentId: string, visitId: string): Promise<MoveState> {
    return move(slug, documentId, "Accepted", ({ db, tenant, actor }) => db.$transaction((tx) => acceptVisit(tx, tenant, actor, visitId)));
}

export async function signJobAction(slug: string, documentId: string, _prev: MoveState, formData: FormData): Promise<MoveState> {
    const stage = z.enum(JobSignStage).safeParse(str(formData, "stage"));
    const role = z.enum(JobSignRole).safeParse(str(formData, "role"));
    if (!stage.success || !role.success) return { ok: false, message: "Choose what you are signing." };
    const decision = str(formData, "decision");
    return move(slug, documentId, "Signed", ({ db, tenant, actor }) =>
        db.$transaction((tx) => signJob(tx, tenant, actor, documentId, {
            stage: stage.data,
            role: role.data,
            decision: decision === "PASSED" || decision === "FAILED" ? decision : undefined,
            driver: role.data === "DRIVER" ? { name: str(formData, "driverName") ?? "", payNumber: str(formData, "driverPayNumber") ?? null } : null,
            comment: str(formData, "comment"),
            returnToWork: str(formData, "returnToWork") === "1",
        })),
    );
}

/** The check bay starts its assessment or quality check, and goes straight to the inspection screen to work through it. */
export async function startCheckAction(slug: string, documentId: string): Promise<MoveState> {
    const { db, tenant, actor } = await onSite(slug);
    let id: string;
    try {
        id = (await db.$transaction((tx) => startCheck(tx, tenant, actor, documentId))).id;
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not started. Try again." };
    }
    redirect(`/${slug}/dashboard/inspections/${id}`);
}

/** Which signatures the council's paper job card asks for at issue. Settings work, so the settings permission. */
export async function saveJobCardSignatures(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user, membership } = await requireFeature(slug, "jobFlow");
    assertCan(membership, "settings:manage");
    const chosen = formData.getAll("issueRoles").map(String).filter((r): r is (typeof JOB_SIGN_ROLES)[number] => (JOB_SIGN_ROLES as readonly string[]).includes(r));
    if (!chosen.length) return { ok: false, message: "Tick at least one signature." };
    return saveJobFlow(slug, { db, tenant, user }, { issueRoles: chosen });
}

/** The inspection templates the check bay's assessment and quality check use, or none. */
export async function saveCheckBayTemplates(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user, membership } = await requireFeature(slug, "jobFlow");
    assertCan(membership, "settings:manage");
    const pick = async (name: string) => {
        const id = str(formData, name);
        if (!id) return null;
        const template = await db.inspectionTemplate.findFirst({ where: { id, active: true }, select: { id: true } });
        return template?.id ?? undefined;
    };
    const [assessmentTemplateId, qualityTemplateId] = await Promise.all([pick("assessmentTemplateId"), pick("qualityTemplateId")]);
    if (assessmentTemplateId === undefined || qualityTemplateId === undefined) return { ok: false, message: "That template is no longer in use. Refresh the page." };
    return saveJobFlow(slug, { db, tenant, user }, { assessmentTemplateId, qualityTemplateId });
}

async function saveJobFlow(
    slug: string,
    { db, tenant, user }: Pick<Awaited<ReturnType<typeof requireFeature>>, "db" | "tenant" | "user">,
    change: Partial<JobFlowSettings>,
): Promise<ActionState> {
    const settings = parseSettings(tenant.settings);
    const parsed = jobFlowSettingsSchema.safeParse({ ...jobFlowSettings(tenant.settings), ...change });
    if (!parsed.success) return { ok: false, message: "Not saved. Check the choices and try again." };
    await db.tenant.update({ where: { id: tenant.id }, data: { settings: { ...settings, jobFlow: parsed.data } } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Tenant", entityId: tenant.id, action: "UPDATED", diff: { section: "jobFlow", ...change } } });
    revalidatePath(`/${slug}/dashboard/settings/workshops`);
    return { ok: true, message: "Saved" };
}
