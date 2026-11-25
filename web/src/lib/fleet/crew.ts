import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { audit, lockJob, personOf, routeOf, type Actor } from "@/lib/fleet/route-db";
import { currentVisit } from "@/lib/fleet/route-rules";
import { assignError, leadOf, mayAssign } from "@/lib/fleet/crew-rules";

/**
 * Putting people on a job while the vehicle is at a workshop or bay, and
 * taking them off. The first still on it is the lead and fills the job card's
 * Mechanic, which the job card prints and the floor app reads.
 */

export type Assigner = Actor & { admin: boolean };

async function stayHere(tx: TenantTx, assigner: Assigner, documentId: string) {
    await lockJob(tx, documentId);
    const visits = await routeOf(tx, documentId);
    const live = currentVisit(visits);
    const visit = live ? visits.find((v) => v.id === live.id)! : null;
    const error = assignError(visit);
    if (error || !visit) throw new Error(error ?? "The vehicle is not at a workshop or bay at the moment.");
    const person = await personOf(tx, assigner.membershipId);
    if (!mayAssign(person, assigner.admin, visit.workshopId)) throw new Error(`Only the foreman of ${visit.name}, their deputy or an administrator can assign people here.`);
    return visit;
}

/** Keep the job card's Mechanic on the lead. A processed job card keeps what it printed. */
async function followLead(tx: TenantTx, documentId: string, visitId: string): Promise<void> {
    const [all, doc] = await Promise.all([
        tx.visitAssignment.findMany({ where: { visitId }, select: { membershipId: true, assignedAt: true, removedAt: true } }),
        tx.document.findFirst({ where: { id: documentId }, select: { mechanicId: true, state: true } }),
    ]);
    if (!doc || doc.state !== "DRAFT") return;
    const lead = leadOf(all);
    if (lead && doc.mechanicId !== lead) await tx.document.updateMany({ where: { id: documentId }, data: { mechanicId: lead } });
    else if (!lead && doc.mechanicId && all.some((a) => a.membershipId === doc.mechanicId)) await tx.document.updateMany({ where: { id: documentId }, data: { mechanicId: null } });
}

/**
 * Who the job card's Mechanic must be while the route decides it: the lead of
 * the stay it is on, once anybody has been assigned there (null when they
 * have all been taken off). Undefined when nobody has been assigned on this
 * stay, and the job card's own Mechanic stands.
 */
export async function routeLead(tx: TenantTx, documentId: string): Promise<string | null | undefined> {
    const stay = await tx.jobVisit.findFirst({ where: { documentId, leftAt: null }, select: { assignments: { select: { membershipId: true, assignedAt: true, removedAt: true } } } });
    if (!stay || stay.assignments.length === 0) return undefined;
    return leadOf(stay.assignments);
}

export async function assign(tx: TenantTx, tenant: Tenant, assigner: Assigner, documentId: string, membershipId: string): Promise<void> {
    const visit = await stayHere(tx, assigner, documentId);
    const staff = await tx.workshopStaff.findFirst({ where: { workshopId: visit.workshopId, membershipId, membership: { status: "ACTIVE" } }, select: { id: true } });
    if (!staff) throw new Error(`Choose somebody on the staff of ${visit.name}.`);
    const already = await tx.visitAssignment.findFirst({ where: { visitId: visit.id, membershipId, removedAt: null }, select: { id: true } });
    if (already) throw new Error("They are already on this job.");
    await tx.visitAssignment.create({ data: { tenantId: tenant.id, visitId: visit.id, membershipId, assignedById: assigner.membershipId } });
    await followLead(tx, documentId, visit.id);
    await audit(tx, tenant, assigner, documentId, "ASSIGNED", { visitId: visit.id, membershipId });
}

export async function unassign(tx: TenantTx, tenant: Tenant, assigner: Assigner, documentId: string, assignmentId: string): Promise<void> {
    const visit = await stayHere(tx, assigner, documentId);
    const ended = await tx.visitAssignment.updateMany({ where: { id: assignmentId, visitId: visit.id, removedAt: null }, data: { removedAt: new Date(), removedById: assigner.membershipId } });
    if (!ended.count) throw new Error("They are no longer on this job. Refresh the page.");
    await followLead(tx, documentId, visit.id);
    await audit(tx, tenant, assigner, documentId, "UNASSIGNED", { visitId: visit.id, assignmentId });
}
