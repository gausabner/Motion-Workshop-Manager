"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { createChange, withdrawChange } from "@/lib/billing/plan-change-service";
import { sendPlanChangeRequestedLetter, sendPlanChangeTeamNotice } from "@/lib/billing/renewal-letters";

export type PlanChangeState = { ok: boolean; message?: string };

const billingPath = (slug: string) => `/${slug}/dashboard/settings/billing`;

/**
 * The owner asks to move plan. Logged, then confirmed by email to whoever
 * asked (with the payment details for a move up) and announced to MOTION's
 * team. The letters go after the response: the request is already committed,
 * so a mail server that is slow or down costs a letter, not the request.
 */
export async function requestPlanChangeAction(slug: string, _prev: PlanChangeState, formData: FormData): Promise<PlanChangeState> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "settings:manage");

    const result = await createChange(db, {
        tenantId: tenant.id,
        tenantStatus: tenant.status,
        userId: user.id,
        toPlanId: String(formData.get("planId") ?? ""),
        now: new Date(),
    });
    if (!result.ok) return { ok: false, message: result.message };

    const { request, reference, period, periodEndsAt, unusedDays, gained, lost } = result.change;
    await db.auditEvent.create({
        data: {
            tenantId: tenant.id,
            actorUserId: user.id,
            entityType: "PlanChangeRequest",
            entityId: request.id,
            action: "REQUESTED",
            diff: { from: request.fromPlanId, to: request.toPlanId, amountInclVat: request.amountInclVat },
        },
    });

    // Whoever asked hears back, and the owner too when it was somebody else:
    // a change to what the workshop pays is the owner's to know about.
    const owner = await db.membership.findFirst({
        where: { tenantId: tenant.id, group: "OWNER", status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { user: { select: { email: true, firstName: true } } },
    });
    const people = [{ email: user.email, firstName: user.firstName }, ...(owner ? [owner.user] : [])].filter(
        (p, i, all) => all.findIndex((x) => x.email.toLowerCase() === p.email.toLowerCase()) === i,
    );

    after(async () => {
        const report = (what: string) => (error: unknown) =>
            console.error(`[plan-change] ${what} could not be sent.`, { workshop: slug, error: error instanceof Error ? error.message : String(error) });
        for (const p of people) await sendPlanChangeRequestedLetter({
            to: p.email,
            firstName: p.firstName,
            workshopName: tenant.name,
            slug,
            kind: request.kind,
            fromPlanName: request.fromPlanName,
            toPlanName: request.toPlanName,
            toPrice: request.toPrice,
            period,
            amountExclVat: request.amountExclVat,
            amountInclVat: request.amountInclVat,
            reference,
            unusedDays,
            nextRenewal: periodEndsAt,
            gained,
            lost,
        }).catch(report("the confirmation"));
        await sendPlanChangeTeamNotice({
            workshopName: tenant.name,
            slug,
            kind: request.kind,
            fromPlanName: request.fromPlanName,
            toPlanName: request.toPlanName,
            amountInclVat: request.amountInclVat,
            reference,
            requestedBy: `${user.firstName} ${user.lastName}`.trim() || user.email,
        }).catch(report("the team notice"));
    });

    revalidatePath(billingPath(slug), "layout");
    redirect(`${billingPath(slug)}/change`);
}

/** The owner takes a request back before anybody has acted on it. */
export async function withdrawPlanChangeAction(slug: string, requestId: string): Promise<void> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "settings:manage");
    if (await withdrawChange(db, tenant.id, requestId)) {
        await db.auditEvent.create({
            data: { tenantId: tenant.id, actorUserId: user.id, entityType: "PlanChangeRequest", entityId: requestId, action: "WITHDRAWN" },
        });
    }
    revalidatePath(billingPath(slug), "layout");
    redirect(billingPath(slug));
}
