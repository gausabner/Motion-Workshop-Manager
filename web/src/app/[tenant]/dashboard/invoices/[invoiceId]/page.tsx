import { InvoiceGenerator } from "@/components/invoices/InvoiceGenerator";

export default async function InvoiceDetailPage({
    params,
}: {
    params: Promise<{ tenant: string; invoiceId: string }>;
}) {
    const resolvedParams = await params;

    return (
        <div className="w-full h-full pt-4 px-2">
            <InvoiceGenerator invoiceId={resolvedParams.invoiceId} tenant={resolvedParams.tenant} />
        </div>
    );
}
