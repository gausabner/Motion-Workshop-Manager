import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { businessToday } from "@/lib/tenant/today";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { getOrder, purchasingOptions } from "@/lib/purchasing/queries";
import { RECEIPT_LABELS } from "@/lib/purchasing/rules";
import { OrderEditor } from "@/components/purchasing/OrderEditor";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Purchase order | MOTION Workshop Manager" };

const STATE: Record<string, string> = { SUGGESTED: "Suggested — not sent yet", ORDERED: "On order", RECEIVED: "All received", CANCELLED: "Cancelled" };

export default async function OrderPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change products and pricing" />;
    const [order, options] = await Promise.all([getOrder(db, id), purchasingOptions(db)]);
    if (!order) notFound();

    return (
        <div className="max-w-5xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/purchasing`} className="text-xs font-medium text-teal-700 hover:underline">← Buying</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">Order {order.number}</h1>
                <p className="text-sm text-slate-500">
                    {STATE[order.state]} · {order.supplier.companyName} · raised {dateShort(order.orderDate)}
                    {order.createdBy ? ` by ${order.createdBy.user.firstName}` : ""}
                    {order.receipt !== "none" && ` · ${RECEIPT_LABELS[order.receipt]}`}
                </p>
            </div>
            <OrderEditor tenant={slug} order={order} options={options} currency={tenant.currency} taxRate={order.taxRate} today={businessToday(tenant.timezone).toISOString().slice(0, 10)} />
        </div>
    );
}
