import "server-only";
import type { JobSignDecision, JobSignRole, JobSignStage, Tenant, VisitPurpose } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { jobFlowSettings } from "@/lib/settings/schema";
import { audit, lockJob, personOf, routeOf, signaturesOf, text, type Actor } from "@/lib/fleet/route-db";
import { checkSignature } from "@/lib/fleet/check-bay";
import { jobLine, nameOf, notify, peopleAt } from "@/lib/notifications/notify";
import {
    collected,
    currentVisit,
    issueMissing,
    KIND_LABEL,
    lastWorkshop,
    mayAccept,
    maySend,
    maySign,
    moveError,
    qualityOutcome,
    ROLE_LABEL,
    signError,
} from "@/lib/fleet/route-rules";

/**
 * A council job's route and signatures, inside transactions: booking a
 * vehicle in, sending it on, accepting it, and every signature on the job
 * card. Each move locks the job card's row first, so two people cannot move
 * one vehicle in two directions at once.
 *
 * Errors are thrown as sentences for the person at the screen.
 */

export type { Actor } from "@/lib/fleet/route-db";

/** Reception books the vehicle in: the route's first stay, received there on arrival. */
export async function bookIn(tx: TenantTx, tenant: Tenant, actor: Actor, documentId: string, receptionId: string, note?: string | null): Promise<void> {
    await lockJob(tx, documentId);
    const visits = await routeOf(tx, documentId);
    if (visits.length) throw new Error("It is already booked in.");
    const place = await tx.workshop.findFirst({ where: { id: receptionId, archivedAt: null }, select: { id: true, kind: true, name: true } });
    if (!place || place.kind !== "RECEPTION") throw new Error("Choose the reception it is booked in at.");
    const person = await personOf(tx, actor.membershipId);
    if (!maySend(person, null, place, "INTAKE")) throw new Error("Only reception books a vehicle in.");
    const now = new Date();
    await tx.jobVisit.create({
        data: { tenantId: tenant.id, documentId, workshopId: place.id, purpose: "INTAKE", sentAt: now, sentById: actor.membershipId, receivedAt: now, receivedById: actor.membershipId, note: text(note) },
    });
    await audit(tx, tenant, actor, documentId, "BOOKED_IN", { at: place.name });
}

/**
 * Send the vehicle on from where it is. The place it leaves records when and
 * by whom; the next place accepts it. Refused, with the reason, if the move is
 * not one the route allows, if the vehicle has not been accepted where it is,
 * or if a gate is shut: an unsigned job card, an unsigned assessment, a
 * quality check not passed.
 */
/** Why it is coming, in the words of a notification. */
const WHY_SENT: Record<VisitPurpose, string> = {
    INTAKE: "To be booked in",
    ASSESSMENT: "For assessment",
    WORK: "For work",
    QUALITY_CHECK: "For its quality check",
    RELEASE: "Ready for the driver to collect",
};

export async function sendOn(tx: TenantTx, tenant: Tenant, actor: Actor, documentId: string, input: { purpose: VisitPurpose; workshopId: string; note?: string | null }): Promise<void> {
    await lockJob(tx, documentId);
    const [visits, signatures, destination, person] = await Promise.all([
        routeOf(tx, documentId),
        signaturesOf(tx, documentId),
        tx.workshop.findFirst({ where: { id: input.workshopId, archivedAt: null }, select: { id: true, kind: true, name: true } }),
        personOf(tx, actor.membershipId),
    ]);
    if (!destination) throw new Error("Choose where it goes from the list.");
    const current = currentVisit(visits);
    const here = current ? visits.find((v) => v.id === current.id)! : null;
    // Only the signatures of this stay at the check bay decide its quality check; an earlier failure is history.
    const sinceArrival = here?.receivedAt ? signatures.filter((s) => s.at >= here.receivedAt!) : [];
    const problem = moveError({
        current,
        purpose: input.purpose,
        destination,
        issueMissing: issueMissing(signatures, jobFlowSettings(tenant.settings).issueRoles),
        assessed: signatures.some((s) => s.stage === "ASSESSMENT"),
        quality: qualityOutcome(sinceArrival),
        lastWorkshopId: lastWorkshop(visits),
    });
    if (problem) throw new Error(problem);
    if (!maySend(person, here ? { id: here.workshopId, kind: here.kind } : null, destination, input.purpose)) {
        throw new Error(here ? `Only somebody working at ${here.name} can send it on.` : "Only reception books a vehicle in.");
    }
    const now = new Date();
    if (current) await tx.jobVisit.update({ where: { id: current.id }, data: { leftAt: now } });
    await tx.jobVisit.create({
        data: { tenantId: tenant.id, documentId, workshopId: destination.id, purpose: input.purpose, sentAt: now, sentById: actor.membershipId, note: text(input.note) },
    });
    await audit(tx, tenant, actor, documentId, "SENT", { purpose: input.purpose, to: destination.name });

    // Tell the people at the place it is going, so they know what to expect.
    const [job, sender, recipients] = await Promise.all([jobLine(tx, documentId), nameOf(tx, actor.membershipId), peopleAt(tx, destination)]);
    await notify(tx, tenant.id, recipients, {
        kind: "VEHICLE_SENT",
        title: `${job.number} is on its way to ${destination.name}`,
        body: [job.vehicle, WHY_SENT[input.purpose], `Sent by ${sender}`, text(input.note)].filter(Boolean).join(". ") + ".",
        href: `dashboard/documents/${documentId}`,
    }, actor.membershipId);
}

/** The place it was sent accepts it, which records who received it and when. */
export async function acceptVisit(tx: TenantTx, tenant: Tenant, actor: Actor, visitId: string): Promise<void> {
    const visit = await tx.jobVisit.findUnique({ where: { id: visitId }, select: { documentId: true, receivedAt: true, leftAt: true, workshop: { select: { id: true, kind: true, name: true } } } });
    if (!visit) throw new Error("That handover no longer exists. Refresh the page.");
    await lockJob(tx, visit.documentId);
    if (visit.leftAt) throw new Error("It has already moved on.");
    if (visit.receivedAt) throw new Error("It has already been accepted.");
    const person = await personOf(tx, actor.membershipId);
    if (!mayAccept(person, visit.workshop)) throw new Error(`Only somebody working at ${visit.workshop.name} can accept it.`);
    const claimed = await tx.jobVisit.updateMany({ where: { id: visitId, receivedAt: null }, data: { receivedAt: new Date(), receivedById: actor.membershipId } });
    if (claimed.count !== 1) throw new Error("Somebody has just accepted it. Refresh the page.");
    await audit(tx, tenant, actor, visit.documentId, "ACCEPTED", { at: visit.workshop.name });
}

/**
 * One signature on the job card. A driver has no login, so reception records
 * them by name and pay number. A quality check is passed or failed; a failure
 * says what failed. When the driver and reception have both signed for
 * collection, the vehicle has left and its route is closed.
 */
export async function signJob(
    tx: TenantTx,
    tenant: Tenant,
    actor: Actor,
    documentId: string,
    input: {
        stage: JobSignStage;
        role: JobSignRole;
        decision?: "PASSED" | "FAILED";
        driver?: { name: string; payNumber: string | null } | null;
        comment?: string | null;
        /** A failed quality check, and the vehicle sent straight back to the workshop that did the work. */
        returnToWork?: boolean;
    },
): Promise<{ collected: boolean }> {
    await lockJob(tx, documentId);
    const [visits, signatures, person, checkBays] = await Promise.all([
        routeOf(tx, documentId),
        signaturesOf(tx, documentId),
        personOf(tx, actor.membershipId),
        tx.workshop.findMany({ where: { kind: "CHECK_BAY" }, select: { id: true } }),
    ]);
    const current = currentVisit(visits);
    const problem = signError({ stage: input.stage, role: input.role, current, signatures, signerId: actor.membershipId, required: jobFlowSettings(tenant.settings).issueRoles });
    if (problem) throw new Error(problem);
    if (!maySign(person, input.role, checkBays.map((c) => c.id))) {
        throw new Error(input.role === "DRIVER" ? "Reception records the driver's signature." : `You cannot sign as ${ROLE_LABEL[input.role].toLowerCase()}.`);
    }
    let decision: JobSignDecision | undefined = input.stage === "QUALITY_CHECK" ? input.decision : "SIGNED";
    let comment = text(input.comment);
    // When the check bay's check is an inspection, the inspection decides: its outcome, and a summary of what it found.
    if ((input.stage === "ASSESSMENT" || input.stage === "QUALITY_CHECK") && current) {
        const check = await checkSignature(tx, tenant, current, input.stage, person.name);
        if (check) {
            decision = check.decision;
            comment = comment ? `${check.summary}. ${comment}`.slice(0, 300) : check.summary;
        }
    }
    if (!decision) throw new Error("Pass or fail the quality check.");
    if (decision === "FAILED" && !comment) throw new Error("Say what failed, so the workshop knows what to put right.");
    if (input.returnToWork && decision !== "FAILED") throw new Error("It passed, so it goes on to reception, not back to the workshop.");

    let name = person.name;
    let payNumber = person.payNumber;
    let membershipId: string | null = actor.membershipId;
    if (input.role === "DRIVER") {
        name = text(input.driver?.name) ?? "";
        if (!name) throw new Error("Write the driver's name.");
        payNumber = text(input.driver?.payNumber);
        membershipId = null;
    }
    const now = new Date();
    await tx.jobSignoff.create({
        data: { tenantId: tenant.id, documentId, stage: input.stage, role: input.role, decision, membershipId, name, payNumber, comment, at: now },
    });
    let done = false;
    if (input.stage === "COLLECTION" && collected([...signatures, { stage: "COLLECTION", role: input.role, decision }]) && current) {
        await tx.jobVisit.update({ where: { id: current.id }, data: { leftAt: now } });
        done = true;
    }
    await audit(tx, tenant, actor, documentId, done ? "COLLECTED" : "SIGNED", { stage: input.stage, role: input.role, decision, recordedFor: membershipId ? undefined : name });
    if (input.returnToWork) {
        const back = lastWorkshop(visits);
        if (!back) throw new Error("No workshop has worked on it yet, so there is nowhere to send it back to.");
        await sendOn(tx, tenant, actor, documentId, { purpose: "WORK", workshopId: back, note: comment ? `Failed: ${comment}`.slice(0, 200) : null });
    }
    return { collected: done };
}

export { KIND_LABEL };
