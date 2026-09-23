import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { getMatrix } from "@/lib/products/matrix-service";
import { MatrixEditor } from "@/components/products/MatrixEditor";

export const metadata = { title: "Price matrix | MOTION Workshop Manager" };

export default async function MatrixPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change products and pricing" />;
    const matrix = await getMatrix(db, id);
    if (!matrix) notFound();
    return (
        <div className="space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/settings/pricing`} className="text-xs font-medium text-teal-700 hover:underline">← Pricing</Link>
                <h3 className="mt-1 text-lg font-medium">{matrix.name}</h3>
                <p className="text-sm text-slate-500">Each band covers a range of costs. Leave the last band&rsquo;s &ldquo;up to&rdquo; empty so nothing expensive falls outside it.</p>
            </div>
            <div className="border-t border-slate-200" />
            <MatrixEditor tenant={slug} matrix={matrix} currency={tenant.currency} />
        </div>
    );
}
