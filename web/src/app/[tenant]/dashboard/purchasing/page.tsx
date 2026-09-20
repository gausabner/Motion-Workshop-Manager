import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listOrders, listSupplierInvoices } from "@/lib/purchasing/queries";
import { newSupplierInvoiceAction } from "@/lib/purchasing/actions";
import { RECEIPT_LABELS } from "@/lib/purchasing/rules";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "Buying | MOTION Workshop Manager" };

const ORDER_STATE: Record<string, string> = { SUGGESTED: "Suggested", ORDERED: "On order", RECEIVED: "All received", CANCELLED: "Cancelled" };
const INVOICE_STATE: Record<string, string> = { DRAFT: "Draft", PROCESSED: "Received", CLOSED: "Paid", VOID: "Voided" };

export default async function PurchasingPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write")) notFound();
    const [orders, invoices] = await Promise.all([listOrders(db), listSupplierInvoices(db)]);
    const base = `/${slug}/dashboard/purchasing`;
    const card = "rounded-sm border border-slate-200 bg-white";

    return (
        <div className="max-w-5xl space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Truck className="h-6 w-6 text-slate-400" />Buying</h1>
                    <p className="text-sm text-slate-500">Orders are a commitment; stock arrives when you enter the supplier&rsquo;s invoice against them.</p>
                </div>
                <div className="flex gap-2">
                    <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700"><Link href={`${base}/orders/new`}><Plus className="mr-1 h-4 w-4" />New order</Link></Button>
                    <form action={newSupplierInvoiceAction.bind(null, slug)}>
                        <Button type="submit" size="sm" variant="outline">Enter supplier invoice</Button>
                    </form>
                </div>
            </div>

            <section className={card}>
                <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Orders</h2>
                {orders.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">No orders yet. Raise one to tell a supplier what you need, and to keep parts tied to the job they are for.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {orders.map((o) => (
                            <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                                <Link href={`${base}/orders/${o.id}`} className="font-medium text-slate-800 hover:text-teal-700">{o.number ?? "Draft"}</Link>
                                <span className="min-w-0 flex-1 truncate text-slate-600">{o.supplier.companyName}</span>
                                <span className="text-xs text-slate-500">{dateShort(o.orderDate)}{o.dueDate ? ` · due ${dateShort(o.dueDate)}` : ""}</span>
                                <span className="tabular-nums text-slate-700">{money(o.total, tenant.currency)}</span>
                                <span className="w-36 text-right text-xs text-slate-500">{ORDER_STATE[o.state]}{o.state === "ORDERED" && o.receipt !== "none" ? ` · ${RECEIPT_LABELS[o.receipt].toLowerCase()}` : ""}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={card}>
                <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Supplier invoices</h2>
                {invoices.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">Nothing entered yet.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {invoices.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                                <Link href={`${base}/invoices/${i.id}`} className="font-medium text-slate-800 hover:text-teal-700">{i.supplierNumber || "No number yet"}</Link>
                                <span className="min-w-0 flex-1 truncate text-slate-600">{i.supplier.companyName}{i.order?.number ? ` · order ${i.order.number}` : ""}</span>
                                <span className="text-xs text-slate-500">{dateShort(i.postDate)}</span>
                                <span className="tabular-nums text-slate-700">{money(i.total, tenant.currency)}</span>
                                <span className={`w-20 text-right text-xs ${i.state === "VOID" ? "text-slate-400" : i.state === "DRAFT" ? "text-amber-700" : "text-slate-500"}`}>{INVOICE_STATE[i.state]}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
