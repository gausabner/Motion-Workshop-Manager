import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { businessToday } from "@/lib/tenant/today";
import { can } from "@/lib/auth/permissions";
import { purchasingOptions } from "@/lib/purchasing/queries";
import { OrderEditor } from "@/components/purchasing/OrderEditor";

export const metadata = { title: "New order | MOTION Workshop Manager" };

export default async function NewOrderPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write")) notFound();
    const options = await purchasingOptions(db);
    return (
        <div className="max-w-5xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/purchasing`} className="text-xs font-medium text-teal-700 hover:underline">← Buying</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">New order</h1>
                <p className="text-sm text-slate-500">It gets its number as soon as you save, so you can quote it to the supplier. Nothing moves on the shelf until the goods arrive.</p>
            </div>
            <OrderEditor tenant={slug} order={null} options={options} currency={tenant.currency} taxRate={tenant.purchaseTaxRate.toNumber()} today={businessToday(tenant.timezone).toISOString().slice(0, 10)} />
        </div>
    );
}
