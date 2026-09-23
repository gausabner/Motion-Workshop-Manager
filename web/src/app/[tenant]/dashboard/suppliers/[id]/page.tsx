import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { listOrders, listSupplierInvoices } from "@/lib/purchasing/queries";
import { openSupplierInvoices } from "@/lib/purchasing/payments";
import { payAllForSupplierAction } from "@/lib/purchasing/payment-actions";
import { Button } from "@/components/ui/button";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "Supplier | MOTION Workshop Manager" };

export default async function SupplierPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change products and pricing" />;
    const supplier = await db.supplier.findUnique({ where: { id } });
    if (!supplier) notFound();
    const [orders, invoices, open] = await Promise.all([listOrders(db), listSupplierInvoices(db), openSupplierInvoices(db, id)]);
    const owed = open.reduce((total, i) => total + i.outstanding, 0);
    const theirs = orders.filter((o) => o.supplier.id === id).slice(0, 8);
    const theirInvoices = invoices.filter((i) => i.supplier.id === id).slice(0, 8);

    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/suppliers`} className="text-xs font-medium text-teal-700 hover:underline">← Suppliers</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">{supplier.companyName}</h1>
                {supplier.archivedAt && <p className="text-sm text-amber-700">Archived {dateShort(supplier.archivedAt)}</p>}
            </div>
            {owed > 0 && can(membership, "payments:take") && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3">
                    <span>
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Owed to them</span>
                        <span className="text-2xl font-bold tabular-nums text-slate-900">{money(owed, tenant.currency)}</span>
                        <span className="ml-2 text-xs text-slate-500">on {open.length} invoice{open.length === 1 ? "" : "s"}</span>
                    </span>
                    <form action={payAllForSupplierAction.bind(null, slug, id)}>
                        <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700">Pay this supplier</Button>
                    </form>
                </div>
            )}

            <SupplierForm tenant={slug} supplier={{ ...supplier, paymentTermsDays: supplier.paymentTermsDays }} />
            {(theirs.length > 0 || theirInvoices.length > 0) && (
                <div className="grid gap-4 sm:grid-cols-2">
                    <section className="rounded-sm border border-slate-200 bg-white">
                        <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent orders</h2>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {theirs.length === 0 && <li className="px-4 py-2 text-slate-500">None yet.</li>}
                            {theirs.map((o) => (
                                <li key={o.id} className="flex items-center justify-between px-4 py-2">
                                    <Link href={`/${slug}/dashboard/purchasing/orders/${o.id}`} className="text-slate-700 hover:text-teal-700">{o.number}</Link>
                                    <span className="tabular-nums text-slate-600">{money(o.total, tenant.currency)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    <section className="rounded-sm border border-slate-200 bg-white">
                        <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent invoices</h2>
                        <ul className="divide-y divide-slate-100 text-sm">
                            {theirInvoices.length === 0 && <li className="px-4 py-2 text-slate-500">None yet.</li>}
                            {theirInvoices.map((i) => (
                                <li key={i.id} className="flex items-center justify-between px-4 py-2">
                                    <Link href={`/${slug}/dashboard/purchasing/invoices/${i.id}`} className="text-slate-700 hover:text-teal-700">{i.supplierNumber || "Draft"}</Link>
                                    <span className="tabular-nums text-slate-600">{money(i.total, tenant.currency)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            )}
        </div>
    );
}
