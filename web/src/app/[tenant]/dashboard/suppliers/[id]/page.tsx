import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { SupplierForm } from "@/components/suppliers/SupplierForm";
import { listOrders, listSupplierInvoices } from "@/lib/purchasing/queries";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "Supplier | MOTION Workshop Manager" };

export default async function SupplierPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write")) notFound();
    const supplier = await db.supplier.findUnique({ where: { id } });
    if (!supplier) notFound();
    const [orders, invoices] = await Promise.all([listOrders(db), listSupplierInvoices(db)]);
    const theirs = orders.filter((o) => o.supplier.id === id).slice(0, 8);
    const theirInvoices = invoices.filter((i) => i.supplier.id === id).slice(0, 8);

    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/suppliers`} className="text-xs font-medium text-teal-700 hover:underline">← Suppliers</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">{supplier.companyName}</h1>
                {supplier.archivedAt && <p className="text-sm text-amber-700">Archived {dateShort(supplier.archivedAt)}</p>}
            </div>
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
