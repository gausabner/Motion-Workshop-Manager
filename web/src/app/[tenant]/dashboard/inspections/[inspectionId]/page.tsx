import { notFound } from "next/navigation";
import { InspectionEditor } from "@/components/inspections/InspectionEditor";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getInspection } from "@/lib/inspections/queries";

export const metadata = { title: "Inspection | MOTION Workshop Manager" };

export default async function InspectionPage({ params }: { params: Promise<{ tenant: string; inspectionId: string }> }) {
    const { tenant: slug, inspectionId } = await params;
    const { db, membership } = await requireTenant(slug);
    const inspection = await getInspection(db, inspectionId);
    if (!inspection) notFound();
    return (
        <div className="mx-auto max-w-4xl">
            {/* Keyed on state, so a refresh after sending starts from what the server now says. */}
            <InspectionEditor key={`${inspection.state}:${inspection.items.map((i) => `${i.approvedAt ? 1 : 0}${i.declinedAt ? 1 : 0}${i.documentLineId ? 1 : 0}`).join("")}`} tenant={slug} inspection={inspection} canSend={can(membership, "messages:send")} />
        </div>
    );
}
