import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { payablesReport } from "@/lib/purchasing/payments";
import { businessToday } from "@/lib/tenant/today";
import { AGEING_LABELS } from "@/lib/payments/allocation";
import { dateShort, money } from "@/lib/format";
import { DownloadPair } from "@/components/exports/DownloadPair";

export const metadata = { title: "What we owe | MOTION Workshop Manager" };

export default async function PayablesPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view") || !can(membership, "products:write")) notFound();
    const asAt = businessToday(tenant.timezone);
    const report = await payablesReport(db, asAt);
    const card = "rounded-sm border border-slate-200 bg-white";
    const buckets = ["current", "d30", "d60", "d90"] as const;

    return (
        <div className="mx-auto w-full max-w-5xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Receipt className="h-6 w-6 text-slate-400" />What we owe</h1>
                    <p className="text-sm text-slate-500">Supplier invoices with money still on them, at {dateShort(asAt)}. Worked out from what has been paid, never stored.</p>
                </div>
                <DownloadPair tenant={slug} report="creditors" />
            </div>

            <div className={`${card} px-4 py-3`}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Owed in total</p>
                <p className="text-3xl font-bold tabular-nums text-slate-900">{money(report.total, tenant.currency)}</p>
                <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    {buckets.map((bucket) => (
                        <span key={bucket} className="flex gap-2">
                            <dt className="text-slate-500">{AGEING_LABELS[bucket]}</dt>
                            <dd className={`tabular-nums ${bucket === "d90" && report.ageing[bucket] > 0 ? "font-semibold text-red-700" : "text-slate-700"}`}>{money(report.ageing[bucket], tenant.currency)}</dd>
                        </span>
                    ))}
                </dl>
            </div>

            {report.suppliers.length === 0 ? (
                <p className={`${card} px-4 py-6 text-center text-sm text-slate-500`}>Nothing owed to anybody.</p>
            ) : (
                report.suppliers.map((supplier) => (
                    <section key={supplier.id} className={card}>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
                            <Link href={`/${slug}/dashboard/suppliers/${supplier.id}`} className="text-sm font-semibold text-slate-800 hover:text-teal-700">{supplier.name}</Link>
                            <span className="text-sm font-semibold tabular-nums text-slate-800">{money(supplier.total, tenant.currency)}</span>
                        </div>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {supplier.invoices.map((invoice) => {
                                const overdue = invoice.dueDate && invoice.dueDate < asAt.toISOString().slice(0, 10);
                                return (
                                    <li key={invoice.id} className="flex flex-wrap items-center gap-x-4 px-4 py-2">
                                        <Link href={`/${slug}/dashboard/purchasing/invoices/${invoice.id}`} className="font-medium text-slate-700 hover:text-teal-700">{invoice.supplierNumber || "No number"}</Link>
                                        <span className="min-w-0 flex-1 text-xs text-slate-500">
                                            {dateShort(invoice.postDate)}
                                            {invoice.dueDate && <span className={overdue ? "font-medium text-amber-700" : ""}> · due {dateShort(invoice.dueDate)}</span>}
                                        </span>
                                        <span className="tabular-nums text-slate-500">{money(invoice.total, tenant.currency)}</span>
                                        <span className="w-28 text-right font-medium tabular-nums text-slate-800">{money(invoice.outstanding, tenant.currency)}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                ))
            )}
        </div>
    );
}
