import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getPayment, openSupplierInvoices } from "@/lib/purchasing/payments";
import { getPaymentMethods } from "@/lib/payments/queries";
import { PaymentEditor } from "@/components/purchasing/PaymentEditor";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "Supplier payment | MOTION Workshop Manager" };

const STATE: Record<string, string> = { DRAFT: "Draft — not paid yet", PROCESSED: "Paid", VOID: "Reversed" };

export default async function SupplierPaymentPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "payments:take")) notFound();
    const [payment, open, methods] = await Promise.all([getPayment(db, id), openSupplierInvoices(db), getPaymentMethods(db)]);
    if (!payment) notFound();

    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/purchasing`} className="text-xs font-medium text-teal-700 hover:underline">← Buying</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">{payment.number ?? "Supplier payment"}</h1>
                <p className="text-sm text-slate-500">
                    {STATE[payment.state]} · {dateShort(payment.postDate)} · {money(payment.amount, tenant.currency)}
                    {payment.createdBy ? ` · ${payment.createdBy.user.firstName}` : ""}
                </p>
            </div>
            {payment.state === "VOID" && (
                <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
                    Reversed {dateShort(payment.voidedAt)}{payment.voidReason ? ` — ${payment.voidReason}` : ""}. The invoices it paid are open again.
                </p>
            )}
            <PaymentEditor tenant={slug} payment={payment} open={open} methods={methods} currency={tenant.currency} />
        </div>
    );
}
