import { JobKanbanBoard } from "@/components/jobs/JobKanbanBoard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function JobsDashboardPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Active Jobs (WIP)</h1>
                    <p className="text-sm text-slate-500">Track and manage vehicle repair orders across the workshop.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Filter</Button>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" /> New Job Card
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <JobKanbanBoard tenant={resolvedParams.tenant} />
            </div>
        </div>
    );
}
