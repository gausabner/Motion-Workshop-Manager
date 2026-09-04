import { PublicBookingWidget } from "@/components/public-widget/PublicBookingWidget";

export default async function PublicBookingPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;

    // Format the URL parameter (e.g. "demo-tenant") into a readable Name
    // In a real app we would fetch the Tenant settings from the API here
    const readableTenantName = resolvedParams.tenant
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-lg mb-8 text-center">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {readableTenantName}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    Powered by MOTION Workshop Manager
                </p>
            </div>

            <PublicBookingWidget tenantName={readableTenantName} />

            <div className="mt-12 text-center text-xs text-slate-400">
                &copy; {new Date().getFullYear()} {readableTenantName}. All rights reserved.
            </div>
        </div>
    );
}
