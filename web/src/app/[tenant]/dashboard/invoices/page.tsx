import { InvoiceList } from "@/components/invoices/InvoiceList";

export default async function InvoicesDashboardPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="flex flex-col h-full max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Invoices & Billing</h1>
                <p className="text-sm text-slate-500">Manage tax invoices, track payments, and follow up on overdue accounts.</p>
            </div>

            <InvoiceList tenant={resolvedParams.tenant} />
        </div>
    );
}
