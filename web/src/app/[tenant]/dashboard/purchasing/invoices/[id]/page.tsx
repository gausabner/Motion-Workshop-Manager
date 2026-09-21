import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getSupplierInvoice, purchasingOptions } from "@/lib/purchasing/queries";
import { ReceiptEditor } from "@/components/purchasing/ReceiptEditor";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Supplier invoice | MOTION Workshop Manager" };

const STATE: Record<string, string> = { DRAFT: "Draft — nothing on the shelf yet", PROCESSED: "Received", CLOSED: "Received and paid", VOID: "Voided" };

export default async function SupplierInvoicePage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write")) notFound();
    const [invoice, options] = await Promise.all([getSupplierInvoice(db, id), purchasingOptions(db)]);
    if (!invoice) notFound();

    return (
        <div className="max-w-5xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/purchasing`} className="text-xs font-medium text-teal-700 hover:underline">← Buying</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">{invoice.supplierNumber || "Supplier invoice"}</h1>
                <p className="text-sm text-slate-500">
                    {STATE[invoice.state]} · {invoice.supplier.companyName} · {dateShort(invoice.postDate)}
                    {invoice.order?.number && <> · against <Link href={`/${slug}/dashboard/purchasing/orders/${invoice.order.id}`} className="text-teal-700 hover:underline">order {invoice.order.number}</Link></>}
                </p>
            </div>
            {invoice.state === "VOID" && (
                <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">Voided {dateShort(invoice.voidedAt)}{invoice.voidReason ? ` — ${invoice.voidReason}` : ""}. The stock came back off the shelf.</p>
            )}
            <ReceiptEditor tenant={slug} invoice={invoice} options={options} currency={tenant.currency} />
        </div>
    );
}
