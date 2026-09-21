import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { productOptions } from "@/lib/products/queries";
import { ProductForm } from "@/components/products/ProductForm";

export const metadata = { title: "New product | MOTION Workshop Manager" };

export default async function NewProductPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write")) notFound();
    const options = await productOptions(db);
    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/products`} className="text-xs font-medium text-teal-700 hover:underline">← Products</Link>
                <h1 className="mt-1 text-xl font-bold text-slate-800">New product</h1>
                <p className="text-sm text-slate-500">Stock on hand starts at nothing; book it in from the product once it is saved.</p>
            </div>
            <ProductForm tenant={slug} product={null} options={options} currency={tenant.currency} />
        </div>
    );
}
