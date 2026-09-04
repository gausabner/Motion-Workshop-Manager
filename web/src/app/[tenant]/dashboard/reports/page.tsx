import { ReportsDashboard } from "@/components/reports/ReportsDashboard";

export default async function ReportsPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="w-full h-full max-w-7xl mx-auto">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Reporting & Analytics</h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time insights across Revenue, Productivity, and Outstanding Balance.</p>
                </div>
            </div>
            <ReportsDashboard />
        </div>
    );
}
