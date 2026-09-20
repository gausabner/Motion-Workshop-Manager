import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listMatrices } from "@/lib/products/matrix-service";
import { newMatrixAction } from "@/lib/products/matrix-actions";

export const metadata = { title: "Pricing | MOTION Workshop Manager" };

const BASIS: Record<string, string> = { MARKUP: "markup on cost", MARGIN: "margin on the price" };
const ROUNDING: Record<string, string> = { NONE: "", WHOLE: " · rounded up to whole", NEAREST_5: " · rounded up to 5", NEAREST_10: " · rounded up to 10", ENDS_99: " · ending .99" };

export default async function PricingSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, membership } = await requireTenant(slug);
    if (!can(membership, "products:write")) notFound();
    const matrices = await listMatrices(db);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 className="text-lg font-medium">Pricing</h3>
                    <p className="text-sm text-slate-500">Markup bands by cost. Put a product on a matrix and its selling price follows its cost — so a supplier&rsquo;s increase does not quietly come out of your margin.</p>
                </div>
                <form action={newMatrixAction.bind(null, slug)}>
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700"><Plus className="mr-1 h-4 w-4" />New matrix</Button>
                </form>
            </div>
            <div className="border-t border-slate-200" />
            <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200 bg-white">
                {matrices.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">No matrices yet. One is usually enough to start: more margin on the cheap things, less on the expensive.</li>}
                {matrices.map((m) => (
                    <li key={m.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${m.active ? "" : "bg-slate-50"}`}>
                        <Link href={`/${slug}/dashboard/settings/pricing/${m.id}`} className={`font-medium hover:underline ${m.active ? "text-slate-800" : "text-slate-400"}`}>{m.name}</Link>
                        <span className="min-w-0 flex-1 text-xs text-slate-500">{m.bands} band{m.bands === 1 ? "" : "s"} · {BASIS[m.basis]}{ROUNDING[m.rounding]}{m.active ? "" : " · not in use"}</span>
                        <span className="text-xs text-slate-500">{m.products} product{m.products === 1 ? "" : "s"}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
