import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { listStockTakes } from "@/lib/stock/stocktake-service";
import { StartStockTake } from "@/components/products/StartStockTake";
import { dateShortIn } from "@/lib/format";

export const metadata = { title: "Stock take | MOTION Workshop Manager" };

const STATE: Record<string, string> = { DRAFT: "Counting", APPLIED: "Applied", CANCELLED: "Cancelled" };

export default async function StockTakePage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "products:write"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change products and pricing" />;
    const [takes, groups] = await Promise.all([
        listStockTakes(db),
        db.productGroup.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    ]);
    const base = `/${slug}/dashboard/products/stock-take`;

    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/products`} className="text-xs font-medium text-teal-700 hover:underline">← Products</Link>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><ClipboardList className="h-6 w-6 text-slate-400" />Stock take</h1>
                <p className="text-sm text-slate-500">Count a shelf at a time and come back to it. Nothing changes until you apply the count, and then it posts as ordinary stock movements.</p>
            </div>

            <StartStockTake tenant={slug} groups={groups} />

            <section className="rounded-sm border border-slate-200 bg-white">
                <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Counts</h2>
                {takes.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">No counts yet.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {takes.map((t) => (
                            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                                <Link href={`${base}/${t.id}`} className="font-medium text-slate-800 hover:text-teal-700">{t.number}</Link>
                                <span className="min-w-0 flex-1 text-slate-500">{t.counted} of {t.lines} counted{t.blind ? " · blind" : ""}</span>
                                <span className="text-xs text-slate-500">{dateShortIn(t.startedAt, tenant.timezone)}{t.by ? ` · ${t.by}` : ""}</span>
                                <span className={`w-20 text-right text-xs ${t.state === "DRAFT" ? "text-amber-700" : "text-slate-500"}`}>{STATE[t.state]}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
