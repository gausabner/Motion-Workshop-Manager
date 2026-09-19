import { notFound } from "next/navigation";
import { ProductList } from "@/components/products/ProductList";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listProducts } from "@/lib/products/queries";

export const metadata = { title: "Products | MOTION Workshop Manager" };

type Search = { q?: string; type?: string; low?: string; archived?: string; page?: string; size?: string };

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<Search> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "documents:see_cost")) notFound();
    const q = sp.q?.trim() ?? "";
    const type = sp.type ?? "";
    const lowOnly = sp.low === "1";
    const archived = sp.archived === "1";
    const data = await listProducts(db, { q, type, lowOnly, archived, page: Number(sp.page) || 1, size: Number(sp.size) || 25 });
    return <ProductList tenant={slug} data={data} q={q} type={type} lowOnly={lowOnly} archived={archived} currency={tenant.currency} canWrite={can(membership, "products:write")} />;
}
