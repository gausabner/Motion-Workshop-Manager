import { PaymentDashboard } from "@/components/payments/PaymentDashboard";

export default async function PaymentsPage({
    params,
}: {
    params: Promise<{ tenant: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="w-full h-full max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Payments & Ledger</h1>
                <p className="text-slate-500 text-sm">Reconcile open invoices, track cash on delivery, and upload EFT proof documents.</p>
            </div>
            <PaymentDashboard />
        </div>
    );
}
