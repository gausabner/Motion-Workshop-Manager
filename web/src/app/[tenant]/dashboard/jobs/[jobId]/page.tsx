import { JobCardDetail } from "@/components/jobs/JobCardDetail";

export default async function JobDetailPage({
    params,
}: {
    params: Promise<{ tenant: string; jobId: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="w-full h-full max-w-7xl mx-auto pt-2">
            <JobCardDetail jobId={resolvedParams.jobId} tenant={resolvedParams.tenant} />
        </div>
    );
}
