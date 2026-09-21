import { JobBoard } from "@/components/jobs/JobBoard";
import { NewDocumentButtons } from "@/components/documents/NewDocumentButtons";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getJobBoard } from "@/lib/documents/queries";

export const metadata = { title: "Jobs | MOTION Workshop Manager" };

export default async function JobsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, membership } = await requireTenant(slug);
    const jobs = await getJobBoard(db);
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Jobs on the floor</h1>
                    <p className="text-sm text-slate-500">{jobs.length} open job card{jobs.length === 1 ? "" : "s"}. Move a card with the selector at its foot.</p>
                </div>
                <NewDocumentButtons tenant={slug} />
            </div>
            <div className="flex-1 overflow-hidden">
                <JobBoard tenant={slug} jobs={jobs} showCost={can(membership, "documents:see_cost")} />
            </div>
        </div>
    );
}
