import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { jobFlowSettings } from "@/lib/settings/schema";
import { addApprovedToJob, createInspection, finalise } from "@/lib/inspections/service";
import { lockJob, personOf, routeOf, signaturesOf, type Actor } from "@/lib/fleet/route-db";
import { CHECK_LABEL, checkOutcome, checkSignError, checkSummary, type CheckPurpose } from "@/lib/fleet/check-rules";
import { currentVisit, worksAt } from "@/lib/fleet/route-rules";

/**
 * The check bay's assessment and quality check, as MOTION's own inspections.
 *
 * The check bay starts the inspection for the stay the vehicle is on, works
 * through it on the inspection screen, and signs on the job card. Signing an
 * assessment puts its red and amber findings on the job card as the work to
 * do; signing a quality check passes or fails it from what the inspection
 * found. Neither goes to a customer: the check bay is the one deciding.
 *
 * A council that has not chosen templates (Settings › Workshops) keeps the
 * plain signature with a note.
 */

const templateFor = (tenant: Tenant, purpose: CheckPurpose) => {
    const settings = jobFlowSettings(tenant.settings);
    return purpose === "ASSESSMENT" ? settings.assessmentTemplateId : settings.qualityTemplateId;
};

/**
 * Start the check bay's inspection for the stay the vehicle is on, or open
 * the one already started. One per stay, so a second tablet finds the first.
 */
export async function startCheck(tx: TenantTx, tenant: Tenant, actor: Actor, documentId: string): Promise<{ id: string }> {
    await lockJob(tx, documentId);
    const [visits, signatures, person] = await Promise.all([routeOf(tx, documentId), signaturesOf(tx, documentId), personOf(tx, actor.membershipId)]);
    const current = currentVisit(visits);
    const here = current ? visits.find((v) => v.id === current.id)! : null;
    if (!here || here.kind !== "CHECK_BAY" || (here.purpose !== "ASSESSMENT" && here.purpose !== "QUALITY_CHECK")) throw new Error("It is not at the check bay for a check.");
    if (!here.receivedAt) throw new Error(`Accept it at ${here.name} first.`);
    if (!worksAt(person, { id: here.workshopId, kind: here.kind })) throw new Error(`Only somebody working at ${here.name} can start its checks.`);
    const purpose: CheckPurpose = here.purpose;
    if (signatures.some((s) => s.stage === purpose && s.at >= here.receivedAt!)) throw new Error(`The ${CHECK_LABEL[purpose]} has been signed already.`);

    const existing = await tx.inspection.findFirst({ where: { visitId: here.id }, select: { id: true } });
    if (existing) return existing;
    const templateId = templateFor(tenant, purpose);
    if (!templateId) throw new Error(`Choose the template for the check bay's ${CHECK_LABEL[purpose]} in Settings › Workshops.`);
    const created = await createInspection(tx, tenant, actor.membershipId, { documentId, templateId });
    await tx.inspection.update({ where: { id: created.id }, data: { purpose, visitId: here.id } });
    return { id: created.id };
}

/**
 * What the check bay's signature says, when its check is an inspection: the
 * outcome and a summary, worked out from the items rather than chosen. The
 * assessment's findings go onto the job card and both inspections are closed,
 * all inside the signing transaction. Returns null when the check is a plain
 * signature (no template chosen and no inspection started).
 */
export async function checkSignature(
    tx: TenantTx,
    tenant: Tenant,
    stay: { id: string },
    purpose: CheckPurpose,
    signer: string,
): Promise<{ decision: "SIGNED" | "PASSED" | "FAILED"; summary: string } | null> {
    const inspection = await tx.inspection.findFirst({
        where: { visitId: stay.id },
        select: { id: true, state: true, items: { orderBy: { ordering: "asc" }, select: { id: true, description: true, urgent: true, soon: true, checked: true, comment: true, approvedAt: true, declinedAt: true } } },
    });
    const required = !!templateFor(tenant, purpose);
    const problem = checkSignError(purpose, required, inspection?.items ?? null);
    if (problem) throw new Error(problem);
    if (!inspection) return null;

    const summary = checkSummary(purpose, inspection.items);
    if (purpose === "ASSESSMENT") {
        // The check bay's findings are the work: approved by the person signing, and on the job card before the vehicle leaves.
        const now = new Date();
        await tx.inspectionItem.updateMany({
            where: { inspectionId: inspection.id, OR: [{ urgent: true }, { soon: true }], approvedAt: null, declinedAt: null },
            data: { approvedAt: now, approvedBy: signer },
        });
        await addApprovedToJob(tx, inspection.id);
        await finalise(tx, inspection.id);
        return { decision: "SIGNED", summary };
    }
    await finalise(tx, inspection.id);
    return { decision: checkOutcome(inspection.items) ?? "FAILED", summary };
}
