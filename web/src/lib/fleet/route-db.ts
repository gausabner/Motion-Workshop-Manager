import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { fullName } from "@/lib/format";
import type { Person, Visit } from "@/lib/fleet/route-rules";

/**
 * What every move on a council job's route reads first, shared by the route
 * (`route.ts`) and the check bay (`check-bay.ts`): the locked job card, the
 * person acting, the stays so far, the signatures so far, and the audit line.
 */

export type Actor = { membershipId: string; userId: string };

export const text = (s: string | null | undefined) => (s?.trim() ? s.trim() : null);

export async function lockJob(tx: TenantTx, documentId: string): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM "Document" WHERE "id" = ${documentId} FOR UPDATE`;
    const job = await tx.document.findFirst({ where: { id: documentId, jobNumber: { not: null }, state: { not: "VOID" } }, select: { id: true } });
    if (!job) throw new Error("That job card is no longer open. Refresh the page.");
}

export async function personOf(tx: TenantTx, membershipId: string): Promise<Person & { name: string; payNumber: string | null }> {
    const m = await tx.membership.findFirst({
        where: { id: membershipId, status: "ACTIVE" },
        select: { designations: true, payNumber: true, user: { select: { firstName: true, lastName: true } }, authorities: { where: { kind: "FOREMAN" }, select: { workshopId: true } } },
    });
    if (!m) throw new Error("Your place in this workshop could not be found. Sign in again.");
    return {
        membershipId,
        designations: m.designations,
        foremanOf: m.authorities.map((a) => a.workshopId).filter((x): x is string => !!x),
        name: fullName(m.user),
        payNumber: m.payNumber,
    };
}

export async function routeOf(tx: TenantTx, documentId: string) {
    const rows = await tx.jobVisit.findMany({
        where: { documentId },
        orderBy: { sentAt: "asc" },
        select: { id: true, workshopId: true, purpose: true, receivedAt: true, leftAt: true, workshop: { select: { kind: true, name: true } } },
    });
    const visits: (Visit & { kind: (typeof rows)[number]["workshop"]["kind"]; name: string; receivedAt: Date | null })[] = rows.map((r) => ({
        id: r.id, workshopId: r.workshopId, purpose: r.purpose, received: !!r.receivedAt, left: !!r.leftAt,
        kind: r.workshop.kind, name: r.workshop.name, receivedAt: r.receivedAt,
    }));
    return visits;
}

export async function signaturesOf(tx: TenantTx, documentId: string) {
    return tx.jobSignoff.findMany({ where: { documentId }, orderBy: { at: "asc" }, select: { stage: true, role: true, decision: true, membershipId: true, at: true } });
}

export async function audit(tx: TenantTx, tenant: Tenant, actor: Actor, documentId: string, action: string, diff: object) {
    await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: actor.userId, entityType: "JobRoute", entityId: documentId, action, diff } });
}

