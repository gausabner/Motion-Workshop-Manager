"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bundleCost, bundlePrice, bundleWarnings } from "@/lib/products/bundles";
import { saveBundleItems } from "@/lib/products/actions";
import type { ProductRecord } from "@/lib/products/queries";
import { money } from "@/lib/format";

type Option = { id: string; itemCode: string; description: string; type: string; cost: number; price: number };
type Row = { key: string; componentId: string; quantity: number };

const cell = "h-8 rounded-sm border border-slate-200 bg-white px-2 text-sm";
let seq = 0;

/**
 * What is inside a bundle. The components are ordinary products, so selling
 * the bundle takes them off the shelf and the job costs what they cost — the
 * bundle only decides what the customer is charged and what they see.
 */
export function BundlePanel({ tenant, product, products, currency }: { tenant: string; product: ProductRecord; products: Option[]; currency: string }) {
    const router = useRouter();
    const [rows, setRows] = useState<Row[]>(product.bundleItems.map((b) => ({ key: b.componentId, componentId: b.componentId, quantity: b.quantity })));
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, start] = useTransition();
    const options = products.filter((p) => p.id !== product.id);

    const components = rows
        .map((r) => ({ row: r, option: options.find((o) => o.id === r.componentId) }))
        .filter((x): x is { row: Row; option: Option } => !!x.option)
        .map(({ row, option }) => ({
            productId: option.id, description: option.description, lineType: "STOCK" as const,
            quantity: row.quantity, unitPrice: option.price, unitCost: option.cost, vatRate: 15,
        }));
    const spec = {
        productId: product.id, description: product.description, lineType: "LABOUR" as const,
        pricing: product.bundlePricing, price: product.retailPrice, vatRate: 15, components,
    };
    const sells = bundlePrice(spec);
    const costs = bundleCost(spec);
    const warnings = bundleWarnings(spec);

    return (
        <section className="rounded-sm border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">What is in this bundle</h2>
                <span className="text-xs text-slate-500">{product.bundlePricing === "FIXED" ? "Sold at the bundle price" : "Sold at the sum of what is in it"}</span>
            </div>
            <ul className="divide-y divide-slate-100">
                {rows.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Nothing in it yet. Add the parts and labour a &ldquo;minor service&rdquo; is made of.</li>}
                {rows.map((row, i) => (
                    <li key={row.key} className="flex flex-wrap items-center gap-2 px-4 py-2">
                        <select value={row.componentId} onChange={(e) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, componentId: e.target.value } : r)))} className={`${cell} min-w-64 flex-1`} aria-label="Component">
                            <option value="">Choose a product</option>
                            {options.map((o) => <option key={o.id} value={o.id}>{o.itemCode} · {o.description}</option>)}
                        </select>
                        <input value={row.quantity} onChange={(e) => setRows((rs) => rs.map((r, n) => (n === i ? { ...r, quantity: Number(e.target.value) || 0 } : r)))} inputMode="decimal" className={`${cell} w-20 text-right tabular-nums`} aria-label="Quantity per bundle" />
                        <span className="w-28 text-right text-xs tabular-nums text-slate-500">
                            {(() => {
                                const option = options.find((o) => o.id === row.componentId);
                                return option ? `${money(option.cost * row.quantity, currency)} cost` : "";
                            })()}
                        </span>
                        <button type="button" onClick={() => setRows((rs) => rs.filter((_, n) => n !== i))} className="p-1 text-slate-400 hover:text-red-700" aria-label="Remove component"><Trash2 className="h-4 w-4" /></button>
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-2">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-teal-700" onClick={() => setRows((rs) => [...rs, { key: `n${++seq}`, componentId: "", quantity: 1 }])}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Add component
                </Button>
                <span className="ml-auto text-sm text-slate-600">
                    Sells for <strong className="tabular-nums">{money(sells, currency)}</strong>, costs <span className="tabular-nums">{money(costs, currency)}</span>
                    {sells > 0 && <span className="text-slate-400"> · {Math.round(((sells - costs) / sells) * 100)}% margin</span>}
                </span>
                <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy}
                    onClick={() => start(async () => {
                        const result = await saveBundleItems(tenant, product.id, rows.filter((r) => r.componentId).map((r) => ({ componentId: r.componentId, quantity: r.quantity })));
                        setStatus({ ok: result.ok, text: result.message });
                        router.refresh();
                    })}>
                    {busy ? "Saving…" : "Save bundle"}
                </Button>
            </div>
            {(warnings.length > 0 || status) && (
                <div className="space-y-1 border-t border-slate-100 px-4 py-2">
                    {warnings.map((w) => <p key={w} className="text-xs text-amber-700">{w}</p>)}
                    {status && <p className={`text-xs ${status.ok ? "text-teal-700" : "text-red-600"}`}>{status.text}</p>}
                </div>
            )}
        </section>
    );
}
