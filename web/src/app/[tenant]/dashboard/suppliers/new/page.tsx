import Link from "next/link";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { SupplierForm } from "@/components/suppliers/SupplierForm";

export const metadata = { title: "New supplier | MOTION Workshop Manager" };

export default async function NewSupplierPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { membership } = await requireTenant(slug);
    if (!can(membership, "products:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change products and pricing" />;
    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/suppliers`} className="text-xs font-medium text-teal-700 hover:underline">← Suppliers</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">New supplier</h1>
            </div>
            <SupplierForm tenant={slug} supplier={null} />
        </div>
    );
}
