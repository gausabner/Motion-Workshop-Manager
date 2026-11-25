"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { fullName } from "@/lib/format";
import { jobLine, notify } from "@/lib/notifications/notify";
import { jobSheet, scheduleMonth } from "@/lib/time/floor-sheet";

/** What the floor app's job sheet reads. Read only; any member of the workshop may open a job card. */
export async function jobSheetAction(slug: string, documentId: string) {
    const { db, membership } = await requireTenant(slug);
    return jobSheet(db, documentId, membership.id);
}

/** Another month for the floor app's calendar, as "2026-12". */
export async function scheduleAction(slug: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("A month reads like 2026-12.");
    const { db, tenant, membership } = await requireTenant(slug);
    return scheduleMonth(db, tenant, membership.id, month);
}

export type StopReason = "PARTS" | "BREAK" | "DONE";

/**
 * Why the mechanic stopped, when they say. Waiting for parts puts the job in
 * that status. "My part is done" tells the foreman of the workshop the vehicle
 * is in, or else the job's service advisor. A break needs nobody told.
 */
export async function stopReasonAction(slug: string, documentId: string, reason: StopReason): Promise<{ ok: boolean; message: string }> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    if (reason === "BREAK") return { ok: true, message: "Enjoy the break." };
    assertCan(membership, "documents:write");
    const doc = await db.document.findFirst({
        where: { id: documentId, type: { in: ["BOOKING", "JOB_CARD"] } },
        select: { state: true, jobStatus: true, serviceAdvisorId: true, visits: { where: { leftAt: null }, take: 1, select: { workshopId: true, workshop: { select: { name: true } } } } },
    });
    if (!doc || doc.state !== "DRAFT") return { ok: false, message: "This job is no longer open." };

    if (reason === "PARTS") {
        if (doc.jobStatus !== "WAITING_FOR_PARTS") {
            await db.$transaction(async (tx) => {
                await tx.document.update({ where: { id: documentId }, data: { jobStatus: "WAITING_FOR_PARTS" } });
                await tx.documentStatusEvent.create({ data: { tenantId: tenant.id, documentId, fromStatus: doc.jobStatus, toStatus: "WAITING_FOR_PARTS", comment: "From the floor app", byId: membership.id } });
                await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Document", entityId: documentId, action: "STATUS_CHANGED", diff: { from: doc.jobStatus, to: "WAITING_FOR_PARTS" } } });
            });
            revalidatePath(`/${slug}/pwa`);
            revalidatePath(`/${slug}/dashboard/jobs`);
        }
        return { ok: true, message: "The job now shows Waiting for parts." };
    }

    const stay = doc.visits[0] ?? null;
    const told = await db.$transaction(async (tx) => {
        const foremen = stay
            ? (await tx.signingAuthority.findMany({ where: { kind: "FOREMAN", workshopId: stay.workshopId, membership: { status: "ACTIVE" } }, select: { membershipId: true } })).map((f) => f.membershipId)
            : [];
        const to = foremen.length ? foremen : doc.serviceAdvisorId ? [doc.serviceAdvisorId] : [];
        const job = await jobLine(tx, documentId);
        return notify(tx, tenant.id, to, {
            kind: "WORK_DONE",
            title: `${fullName(user)} has finished their part on ${job.number}`,
            body: [job.vehicle, stay ? `At ${stay.workshop.name}` : null].filter(Boolean).join(". ") + ".",
            href: `dashboard/documents/${documentId}`,
        }, membership.id);
    });
    return told
        ? { ok: true, message: stay ? `The foreman of ${stay.workshop.name} has been told.` : "The service advisor has been told." }
        : { ok: true, message: "Nobody is set up to be told. Tell the foreman yourself." };
}
