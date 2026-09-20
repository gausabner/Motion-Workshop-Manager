"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marginPercent, matrixWarnings, priceFrom, type Band } from "@/lib/products/matrix";
import { previewRepriceAction, repriceMatrixAction, saveMatrixAction, deleteMatrixAction } from "@/lib/products/matrix-actions";
import type { MatrixRecord } from "@/lib/products/matrix-service";
import type { RepriceRow } from "@/lib/products/matrix-service";
import { money } from "@/lib/format";

type Row = Band & { key: string };
const cell = "h-8 rounded-sm border border-slate-200 bg-white px-2 text-sm";
const numCell = `${cell} w-28 text-right tabular-nums`;
let seq = 0;

/** A few costs a workshop recognises, so the bands can be seen doing their job. */
const SAMPLES = [15, 45, 120, 480, 1800, 6500];

export function MatrixEditor({ tenant, matrix, currency }: { tenant: string; matrix: MatrixRecord; currency: string }) {
    const router = useRouter();
    const [name, setName] = useState(matrix.name);
    const [basis, setBasis] = useState(matrix.basis);
    const [rounding, setRounding] = useState(matrix.rounding);
    const [active, setActive] = useState(matrix.active);
    const [bands, setBands] = useState<Row[]>(matrix.bands.map((b) => ({ key: b.id, costFrom: b.costFrom, costTo: b.costTo, percent: b.percent })));
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [preview, setPreview] = useState<{ changes: RepriceRow[]; unchanged: number; unpriceable: number } | null>(null);
    const [busy, start] = useTransition();

    const spec = { basis, rounding, bands };
    const warnings = matrixWarnings(bands);
    const set = (i: number, patch: Partial<Row>) => setBands((bs) => bs.map((b, n) => (n === i ? { ...b, ...patch } : b)));
    const payload = () => ({ name: name.trim(), basis, rounding, active, bands: bands.map(({ costFrom, costTo, percent }) => ({ costFrom, costTo, percent })) });

    const run = (work: () => Promise<{ ok: boolean; message: string }>) => start(async () => {
        const result = await work();
        setStatus({ ok: result.ok, text: result.message });
        router.refresh();
    });

    return (
        <div className="space-y-4">
            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Name</span><input value={name} onChange={(e) => setName(e.target.value)} className={`${cell} h-9 w-full`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">The percentage is</span>
                        <select value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)} className={`${cell} h-9 w-full`}>
                            <option value="MARKUP">added to the cost (markup)</option>
                            <option value="MARGIN">taken out of the price (margin)</option>
                        </select>
                    </label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Round prices</span>
                        <select value={rounding} onChange={(e) => setRounding(e.target.value as typeof rounding)} className={`${cell} h-9 w-full`}>
                            <option value="NONE">not at all</option>
                            <option value="WHOLE">up to the next whole</option>
                            <option value="NEAREST_5">up to the next 5</option>
                            <option value="NEAREST_10">up to the next 10</option>
                            <option value="ENDS_99">up to the next .99</option>
                        </select>
                    </label>
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
                        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-teal-600" />In use
                    </label>
                </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <section className="rounded-sm border border-slate-200 bg-white">
                    <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <span className="col-span-4">Cost from</span><span className="col-span-4">up to</span><span className="col-span-3 text-right">{basis === "MARKUP" ? "Markup %" : "Margin %"}</span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {bands.map((band, i) => (
                            <li key={band.key} className="grid grid-cols-12 items-center gap-2 px-4 py-2">
                                <input value={band.costFrom} onChange={(e) => set(i, { costFrom: Number(e.target.value) || 0 })} inputMode="decimal" className={`${numCell} col-span-4 w-full`} aria-label="Cost from" />
                                <input
                                    value={band.costTo ?? ""} placeholder="and above" inputMode="decimal"
                                    onChange={(e) => set(i, { costTo: e.target.value.trim() === "" ? null : Number(e.target.value) || 0 })}
                                    className={`${numCell} col-span-4 w-full`} aria-label="Cost to"
                                />
                                <input value={band.percent} onChange={(e) => set(i, { percent: Number(e.target.value) || 0 })} inputMode="decimal" className={`${numCell} col-span-3 w-full`} aria-label="Percent" />
                                <button type="button" onClick={() => setBands((bs) => (bs.length === 1 ? bs : bs.filter((_, n) => n !== i)))} className="col-span-1 justify-self-end p-1 text-slate-400 hover:text-red-700" aria-label="Remove band"><Trash2 className="h-4 w-4" /></button>
                            </li>
                        ))}
                    </ul>
                    <div className="border-t border-slate-100 px-4 py-2">
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-teal-700"
                            onClick={() => setBands((bs) => [...bs, { key: `n${++seq}`, costFrom: bs.length ? (bs[bs.length - 1].costTo ?? 0) + 0.01 : 0, costTo: null, percent: 50 }])}>
                            <Plus className="mr-1 h-3.5 w-3.5" />Add band
                        </Button>
                    </div>
                    {warnings.length > 0 && (
                        <ul className="space-y-0.5 border-t border-slate-100 px-4 py-2">
                            {warnings.map((w) => <li key={w} className="text-xs text-amber-700">{w}</li>)}
                        </ul>
                    )}
                </section>

                <section className="rounded-sm border border-slate-200 bg-white lg:sticky lg:top-4 lg:self-start">
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What it would charge</h2>
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                            {SAMPLES.map((cost) => {
                                const price = priceFrom(cost, spec);
                                const margin = price === null ? null : marginPercent(cost, price);
                                return (
                                    <tr key={cost}>
                                        <td className="px-4 py-1.5 tabular-nums text-slate-500">{money(cost, currency)}</td>
                                        <td className="px-2 py-1.5 text-right font-medium tabular-nums text-slate-800">{price === null ? "—" : money(price, currency)}</td>
                                        <td className="px-4 py-1.5 text-right text-xs tabular-nums text-slate-400">{margin === null ? "" : `${Math.round(margin)}%`}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Cost on the left, what it would sell for on the right, and the margin that leaves.</p>
                </section>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={() => run(() => saveMatrixAction(tenant, matrix.id, payload()))}>{busy ? "Saving…" : "Save matrix"}</Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => start(async () => setPreview(await previewRepriceAction(tenant, matrix.id)))}>
                    See what repricing would change
                </Button>
                {matrix.products === 0 && (
                    <Button type="button" variant="ghost" className="text-slate-500" disabled={busy}
                        onClick={() => { if (window.confirm("Delete this matrix?")) start(async () => { const r = await deleteMatrixAction(tenant, matrix.id); if (r && !r.ok) setStatus({ ok: false, text: r.message ?? "Not deleted" }); }); }}>
                        Delete
                    </Button>
                )}
                <span className="text-sm text-slate-500">{matrix.products} product{matrix.products === 1 ? "" : "s"} priced by this matrix</span>
                {status && <p className={`text-sm ${status.ok ? "text-teal-700" : "text-red-600"}`} role={status.ok ? undefined : "alert"}>{status.text}</p>}
            </div>

            {preview && (
                <section className="rounded-sm border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            {preview.changes.length} price{preview.changes.length === 1 ? "" : "s"} would change · {preview.unchanged} already right{preview.unpriceable > 0 ? ` · ${preview.unpriceable} the bands cannot price` : ""}
                        </h2>
                        {preview.changes.length > 0 && (
                            <Button type="button" size="sm" className="h-7 bg-teal-600 hover:bg-teal-700" disabled={busy}
                                onClick={() => run(async () => { const r = await repriceMatrixAction(tenant, matrix.id); setPreview(null); return r; })}>
                                Apply these prices
                            </Button>
                        )}
                    </div>
                    <ul className="divide-y divide-slate-100 text-sm">
                        {preview.changes.slice(0, 50).map((row) => (
                            <li key={row.id} className="flex flex-wrap items-center gap-x-4 px-4 py-1.5">
                                <span className="font-medium text-slate-800">{row.itemCode}</span>
                                <span className="min-w-0 flex-1 truncate text-slate-500">{row.description}</span>
                                <span className="text-xs tabular-nums text-slate-400">cost {money(row.cost, currency)}</span>
                                <span className="tabular-nums text-slate-500">{money(row.from, currency)}</span>
                                <span className="tabular-nums font-medium text-slate-900">→ {money(row.to, currency)}</span>
                            </li>
                        ))}
                        {preview.changes.length > 50 && <li className="px-4 py-1.5 text-xs text-slate-400">and {preview.changes.length - 50} more…</li>}
                    </ul>
                </section>
            )}
        </div>
    );
}
