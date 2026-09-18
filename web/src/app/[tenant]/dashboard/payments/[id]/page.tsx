import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentEditor } from "@/components/payments/PaymentEditor";
import { PaymentStatePill } from "@/components/payments/PaymentList";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getOpenItems, getPayment, getPaymentMethods } from "@/lib/payments/queries";
import { dateShort, money } from "@/lib/format";

export default async function PaymentPage({ params, searchParams }: { params: Promise<{ tenant: string; id: string }>; searchParams: Promise<{ posted?: string }> }) {
    const [{ tenant: slug, id }, { posted }] = await Promise.all([params, searchParams]);
    const { db, membership } = await requireTenant(slug);
    if (!can(membership, "payments:take")) notFound();

    const [payment, methods] = await Promise.all([getPayment(db, id), getPaymentMethods(db)]);
    if (!payment) notFound();
    const openItems = payment.customer ? await getOpenItems(db, payment.customer.id) : [];

    return (
        <div className="max-w-7xl mx-auto space-y-4 pb-16">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <Wallet className="w-6 h-6 text-slate-400 mt-0.5" />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 leading-tight flex items-center gap-3 flex-wrap">
                            Receipt {payment.number ?? ""}
                            <PaymentStatePill state={payment.state} />
                        </h1>
                        <p className="text-xs text-slate-500 flex items-center gap-3 flex-wrap mt-0.5">
                            {payment.customer && (
                                <Link href={`/${slug}/dashboard/customers/${payment.customer.id}`} className="hover:text-teal-700 flex items-center gap-1">
                                    <User className="w-3 h-3" />{payment.customer.firstName} {payment.customer.lastName}
                                </Link>
                            )}
                            <span>{dateShort(payment.postDate)}</span>
                            {payment.state !== "DRAFT" && <span className="font-semibold text-slate-700">{money(payment.amount)}</span>}
                            {payment.takenBy && <span>taken by {payment.takenBy.user.firstName} {payment.takenBy.user.lastName}</span>}
                        </p>
                    </div>
                </div>
                <Button asChild size="sm" variant="outline">
                    <a href={`/${slug}/dashboard/payments/${payment.id}/pdf`} target="_blank" rel="noopener noreferrer">
                        <Printer className="w-4 h-4 mr-1" />Print
                    </a>
                </Button>
            </div>

            {posted && (
                <p className="rounded-sm border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
                    Posted as <strong>{payment.number}</strong>. The invoices it settled are now closed.
                </p>
            )}
            {payment.state === "VOID" && (
                <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
                    Voided {dateShort(payment.voidedAt)}{payment.voidReason ? ` — ${payment.voidReason}` : ""}. Anything it settled has been re-opened.
                </p>
            )}

            <PaymentEditor tenant={slug} payment={payment} methods={methods} openItems={openItems} />
        </div>
    );
}
