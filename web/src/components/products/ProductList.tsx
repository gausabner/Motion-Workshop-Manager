import Link from "next/link";
import { Package, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import type { listProducts } from "@/lib/products/queries";

type Data = Awaited<ReturnType<typeof listProducts>>;

const TYPE_LABEL: Record<string, string> = { STOCK: "Part", LABOUR: "Labour", SUBLET: "Sublet", CONSUMABLE: "Consumable", ACCESSORY: "Accessory", TYRE: "Tyre" };

/** The shelf: what is there, what it cost, and what is running out. */
export function ProductList({ tenant, data, q, type, lowOnly, archived, currency, canWrite }: {
    tenant: string; data: Data; q: string; type: string; lowOnly: boolean; archived: boolean; currency: string; canWrite: boolean;
}) {
    const base = `/${tenant}/dashboard/products`;
    const value = data.rows.reduce((sum, r) => sum + r.value, 0);
    const link = (over: Record<string, string>) => {
        const sp = new URLSearchParams({ ...(q ? { q } : {}), ...(type ? { type } : {}), ...(lowOnly ? { low: "1" } : {}), ...(archived ? { archived: "1" } : {}), ...over });
        return `${base}?${sp.toString()}`;
    };

    return (
        <div className="max-w-6xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Package className="h-6 w-6 text-slate-400" />Products</h1>
                    <p className="text-sm text-slate-500">{data.total} {archived ? "archived" : "on the list"} · {money(value, currency)} of stock on this page, at cost</p>
                </div>
                <span className="flex gap-2">
                    <Button asChild size="sm" variant="outline"><Link href={`${base}/serials`}>Find a serial</Link></Button>
                    {canWrite && <Button asChild size="sm" variant="outline"><Link href={`${base}/stock-take`}>Stock take</Link></Button>}
                    {canWrite && <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700"><Link href={`${base}/new`}><Plus className="mr-1 h-4 w-4" />New product</Link></Button>}
                </span>
            </div>

            <form action={base} method="get" className="flex flex-wrap items-center gap-2">
                <input name="q" defaultValue={q} placeholder="Code, description, brand or shelf" className="h-9 w-64 rounded-md border border-slate-300 px-3 text-sm" />
                <select name="type" defaultValue={type} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm">
                    <option value="">Every type</option>
                    {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="accent-teal-600" />At or below minimum</label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600"><input type="checkbox" name="archived" value="1" defaultChecked={archived} className="accent-teal-600" />Archived</label>
                <Button type="submit" size="sm" variant="outline" className="h-9">Search</Button>
            </form>

            <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                            <th className="px-4 py-2 text-left font-semibold">Code</th>
                            <th className="px-2 py-2 text-left font-semibold">Description</th>
                            <th className="px-2 py-2 text-left font-semibold">Type</th>
                            <th className="px-2 py-2 text-left font-semibold">Shelf</th>
                            <th className="px-2 py-2 text-right font-semibold">On hand</th>
                            <th className="px-2 py-2 text-right font-semibold">Cost</th>
                            <th className="px-2 py-2 text-right font-semibold">Sell</th>
                            <th className="px-4 py-2 text-right font-semibold">Margin</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-500">Nothing matches.</td></tr>}
                        {data.rows.map((r) => {
                            const margin = r.retail > 0 ? Math.round(((r.retail - r.cost) / r.retail) * 100) : null;
                            const low = r.tracked && r.onHand <= r.minQty;
                            return (
                                <tr key={r.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2"><Link href={`${base}/${r.id}`} className="font-medium text-slate-800 hover:text-teal-700">{r.itemCode}</Link></td>
                                    <td className="px-2 py-2 text-slate-700">{r.description}</td>
                                    <td className="px-2 py-2 text-slate-500">{TYPE_LABEL[r.type] ?? r.type}</td>
                                    <td className="px-2 py-2 text-slate-500">{r.location ?? ""}</td>
                                    <td className={`px-2 py-2 text-right tabular-nums ${r.onHand < 0 ? "font-semibold text-red-700" : low ? "font-medium text-amber-700" : "text-slate-700"}`}>
                                        {r.tracked ? r.onHand : <span className="text-slate-300">—</span>}
                                        {low && r.onHand >= 0 && <AlertTriangle className="ml-1 inline h-3 w-3" aria-label="At or below minimum" />}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums text-slate-600">{money(r.cost, currency)}</td>
                                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">{money(r.retail, currency)}</td>
                                    <td className={`px-4 py-2 text-right tabular-nums ${margin !== null && margin < 0 ? "text-red-700" : "text-slate-500"}`}>{margin === null ? "" : `${margin}%`}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {data.pages > 1 && (
                <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>Page {data.page} of {data.pages}</span>
                    <span className="flex gap-2">
                        {data.page > 1 && <Link href={link({ page: String(data.page - 1) })} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">Previous</Link>}
                        {data.page < data.pages && <Link href={link({ page: String(data.page + 1) })} className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">Next</Link>}
                    </span>
                </div>
            )}
        </div>
    );
}
