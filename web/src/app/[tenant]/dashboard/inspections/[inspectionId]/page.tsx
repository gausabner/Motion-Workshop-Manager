import { InspectionChecklist } from "@/components/inspections/InspectionChecklist";

export default async function InspectionDetailPage({
    params,
}: {
    params: Promise<{ tenant: string; inspectionId: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="w-full h-full pt-4 px-2">
            <InspectionChecklist inspectionId={resolvedParams.inspectionId} tenant={resolvedParams.tenant} />
        </div>
    );
}
