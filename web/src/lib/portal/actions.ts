"use server";

import { redirect } from "next/navigation";
import { mintShareLink } from "@/lib/sharing/links";
import { portalAccess } from "@/lib/portal/data";

/**
 * Open one of the customer's inspections from their portal. The approval page
 * works on its own link, so a fresh one is minted here — on a POST, not on a
 * page load, so a link preview or a prefetch cannot create one. It lasts no
 * longer than the portal link it came from.
 */
export async function openPortalInspection(token: string, inspectionId: string): Promise<void> {
    const access = await portalAccess(token);
    if (!access.ok || !access.settings.sections.inspections) redirect(`/portal/${token}`);
    const { db, tenant, customer, share } = access;
    const inspection = await db.inspection.findUnique({ where: { id: inspectionId }, select: { id: true, customerId: true, state: true } });
    if (!inspection || inspection.customerId !== customer.id || inspection.state === "DRAFT") redirect(`/portal/${token}`);
    const expires = await db.shareLink.findUnique({ where: { id: share.id }, select: { expiresAt: true } });
    const days = Math.max(1, Math.min(90, Math.ceil(((expires?.expiresAt.getTime() ?? Date.now()) - Date.now()) / 86_400_000)));
    const link = await db.$transaction((tx) => mintShareLink(tx, { tenantId: tenant.id, kind: "INSPECTION", targetId: inspection.id, createdById: null, days }));
    redirect(`/approve/${link.token}`);
}
