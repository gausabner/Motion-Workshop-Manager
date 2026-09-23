import Link from "next/link";
import { Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";

export const metadata = { title: "Suppliers | MOTION Workshop Manager" };

export default async function SuppliersPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ archived?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, membership } = await requireTenant(slug);
    if (!can(membership, "products:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change products and pricing" />;
    const archived = sp.archived === "1";
    const suppliers = await db.supplier.findMany({
        where: { archivedAt: archived ? { not: null } : null },
        orderBy: { companyName: "asc" },
        select: { id: true, companyName: true, accountNumber: true, phone: true, email: true, city: true, paymentTermsDays: true, _count: { select: { products: true, purchaseOrders: true } } },
    });
    const base = `/${slug}/dashboard/suppliers`;
    return (
        <div className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Building2 className="h-6 w-6 text-slate-400" />Suppliers</h1>
                    <p className="text-sm text-slate-500">Who you buy from. <Link href={archived ? base : `${base}?archived=1`} className="text-teal-700 hover:underline">{archived ? "Show current" : "Show archived"}</Link></p>
                </div>
                <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700"><Link href={`${base}/new`}><Plus className="mr-1 h-4 w-4" />New supplier</Link></Button>
            </div>
            <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200 bg-white">
                {suppliers.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">None yet.</li>}
                {suppliers.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                        <Link href={`${base}/${s.id}`} className="font-medium text-slate-800 hover:text-teal-700">{s.companyName}</Link>
                        <span className="min-w-0 flex-1 truncate text-slate-500">{[s.accountNumber, s.city, s.phone, s.email].filter(Boolean).join(" · ")}</span>
                        <span className="text-xs text-slate-400">{s._count.products} product{s._count.products === 1 ? "" : "s"} · {s._count.purchaseOrders} order{s._count.purchaseOrders === 1 ? "" : "s"}{s.paymentTermsDays !== null ? ` · ${s.paymentTermsDays} days` : ""}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
