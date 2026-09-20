"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { costTotals, keepMarginPrice, unitCostExTax } from "@/lib/purchasing/rules";
import { processInvoiceAction, saveInvoiceAction, voidInvoiceAction } from "@/lib/purchasing/actions";
import type { SupplierInvoiceRecord } from "@/lib/purchasing/queries";
import { money } from "@/lib/format";

type Options = { suppliers: { id: string; companyName: string }[]; products: { id: string; itemCode: string; description: string; cost: number; price: number }[]; jobs: { id: string; label: string }[] };
type Line = {
    key: string; id?: string; productId: string; description: string; quantity: number; unitCost: number; taxExempt: boolean;
    orderLineId: string | null; documentId: string; newSellPrice: string; currentCost: number | null; currentPrice: number | null;
};

const cell = "h-8 w-full rounded-sm border border-slate-200 bg-white px-2 text-sm disabled:bg-slate-50 disabled:text-slate-500";
const numCell = `${cell} text-right tabular-nums`;
let seq = 0;
const blank = (): Line => ({ key: `n${++seq}`, productId: "", description: "", quantity: 1, unitCost: 0, taxExempt: false, orderLineId: null, documentId: "", newSellPrice: "", currentCost: null, currentPrice: null });

/**
 * The goods arriving. This is the document that moves stock, so it asks for
 * the supplier's own invoice number, and offers a new sell price worked out
 * from the cost just paid.
 */
export function ReceiptEditor({ tenant, invoice, options, currency }: { tenant: string; invoice: SupplierInvoiceRecord; options: Options; currency: string }) {
    const router = useRouter();
    const editable = invoice.state === "DRAFT";
    const [supplierId, setSupplierId] = useState(invoice.supplier.id);
    const [supplierNumber, setSupplierNumber] = useState(invoice.supplierNumber);
    const [otherReference, setOtherReference] = useState(invoice.otherReference ?? "");
    const [postDate, setPostDate] = useState(invoice.postDate);
    const [dueDate, setDueDate] = useState(invoice.dueDate ?? "");
    const [taxRate, setTaxRate] = useState(invoice.taxRate);
    const [pricesIncludeTax, setPricesIncludeTax] = useState(invoice.pricesIncludeTax);
    const [freight, setFreight] = useState(invoice.freight);
    const [note, setNote] = useState(invoice.note ?? "");
    const [lines, setLines] = useState<Line[]>(
        invoice.lines.length
            ? invoice.lines.map((l) => ({
                key: l.id, id: l.id, productId: l.productId ?? "", description: l.description, quantity: l.quantity, unitCost: l.unitCost,
                taxExempt: l.taxExempt, orderLineId: l.orderLineId, documentId: l.documentId ?? "",
                newSellPrice: l.newSellPrice === null ? "" : String(l.newSellPrice), currentCost: l.currentCost, currentPrice: l.currentPrice,
            }))
            : [blank()],
    );
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, start] = useTransition();

    const totals = costTotals(lines.map((l) => ({ quantity: l.quantity, unitCost: l.unitCost, taxExempt: l.taxExempt })), { taxRate, pricesIncludeTax, freight });
    const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...patch } : l)));

    function pickProduct(i: number, productId: string) {
        const product = options.products.find((p) => p.id === productId);
        set(i, {
            productId, currentCost: product?.cost ?? null, currentPrice: product?.price ?? null,
            ...(product ? { description: lines[i].description || product.description, unitCost: lines[i].unitCost || product.cost } : {}),
        });
    }

    const payload = () => ({
        supplierId, supplierNumber, otherReference, postDate, dueDate, taxRate, pricesIncludeTax, freight, note,
        lines: lines.map((l) => ({
            id: l.id, productId: l.productId || null, description: l.description, quantity: l.quantity, unitCost: l.unitCost,
            taxExempt: l.taxExempt, orderLineId: l.orderLineId, documentId: l.documentId || null, newSellPrice: l.newSellPrice === "" ? null : Number(l.newSellPrice),
        })),
    });

    function save(after?: () => void) {
        setStatus(null);
        start(async () => {
            const result = await saveInvoiceAction(tenant, invoice.id, payload());
            if (!result.ok) {
                setStatus({ ok: false, text: result.message });
                return;
            }
            if (after) after();
            else {
                setStatus({ ok: true, text: "Saved" });
                router.refresh();
            }
        });
    }

    function process() {
        save(() => start(async () => {
            const result = await processInvoiceAction(tenant, invoice.id);
            setStatus({ ok: result.ok, text: result.message });
            router.refresh();
        }));
    }

    return (
        <div className="space-y-4">
            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Supplier</span>
                        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={!editable} className={`${cell} h-9`}>
                            {options.suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Their invoice number</span><input value={supplierNumber} onChange={(e) => setSupplierNumber(e.target.value)} disabled={!editable} placeholder="e.g. 4471" className={`${cell} h-9`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Invoice date</span><input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} disabled={!editable} className={`${cell} h-9`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Due</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!editable} className={`${cell} h-9`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Other reference</span><input value={otherReference} onChange={(e) => setOtherReference(e.target.value)} disabled={!editable} className={`${cell} h-9`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Tax rate</span><input value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} inputMode="decimal" disabled={!editable} className={`${numCell} h-9`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Freight</span><input value={freight} onChange={(e) => setFreight(Number(e.target.value) || 0)} inputMode="decimal" disabled={!editable} className={`${numCell} h-9`} /></label>
                    <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
                        <input type="checkbox" checked={pricesIncludeTax} onChange={(e) => setPricesIncludeTax(e.target.checked)} disabled={!editable} className="accent-teal-600" />
                        Their costs include tax
                    </label>
                </div>
            </section>

            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="hidden grid-cols-12 gap-2 border-b bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
                    <span className="col-span-3">Product</span><span className="col-span-3">Description</span><span className="col-span-1 text-right">Qty</span>
                    <span className="col-span-1 text-right">Cost</span><span className="col-span-2">New sell price</span><span className="col-span-1 text-right">Total</span>
                </div>
                <ul className="divide-y divide-slate-100">
                    {lines.map((line, i) => {
                        const costExTax = unitCostExTax(line.unitCost, taxRate, pricesIncludeTax, line.taxExempt);
                        const suggestion = line.currentCost !== null && line.currentPrice !== null ? keepMarginPrice(costExTax, line.currentCost, line.currentPrice) : null;
                        const costRose = line.currentCost !== null && costExTax > line.currentCost;
                        return (
                            <li key={line.key} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                                <select value={line.productId} onChange={(e) => pickProduct(i, e.target.value)} disabled={!editable} className={`${cell} col-span-12 md:col-span-3`}>
                                    <option value="">Not a stocked product</option>
                                    {options.products.map((p) => <option key={p.id} value={p.id}>{p.itemCode} · {p.description}</option>)}
                                </select>
                                <input value={line.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="What arrived" disabled={!editable} className={`${cell} col-span-12 md:col-span-3`} />
                                <input value={line.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) || 0 })} inputMode="decimal" disabled={!editable} className={`${numCell} col-span-3 md:col-span-1`} aria-label="Quantity" />
                                <input value={line.unitCost} onChange={(e) => set(i, { unitCost: Number(e.target.value) || 0 })} inputMode="decimal" disabled={!editable} className={`${numCell} col-span-3 md:col-span-1`} aria-label="Unit cost" />
                                <span className="col-span-5 flex items-center gap-1 md:col-span-2">
                                    <input value={line.newSellPrice} onChange={(e) => set(i, { newSellPrice: e.target.value })} inputMode="decimal" placeholder={line.currentPrice !== null ? `now ${line.currentPrice}` : "—"} disabled={!editable || !line.productId} className={`${numCell}`} aria-label="New sell price" />
                                    {editable && suggestion !== null && suggestion !== line.currentPrice && (
                                        <button type="button" onClick={() => set(i, { newSellPrice: String(suggestion) })} className="whitespace-nowrap rounded bg-slate-100 px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-200" title="Keep the margin this product sells at today">
                                            {suggestion}
                                        </button>
                                    )}
                                </span>
                                <span className="col-span-6 text-right text-sm tabular-nums text-slate-700 md:col-span-1">
                                    {money(line.quantity * line.unitCost, currency)}
                                    {costRose && <span className="block text-[10px] text-amber-700">cost up</span>}
                                </span>
                                {editable && (
                                    <button type="button" onClick={() => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, n) => n !== i)))} className="col-span-1 justify-self-end p-1 text-slate-400 hover:text-red-700" aria-label="Remove line">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {editable && (
                    <div className="border-t border-slate-100 px-3 py-2">
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-teal-700" onClick={() => setLines((ls) => [...ls, blank()])}><Plus className="mr-1 h-3.5 w-3.5" />Add line</Button>
                    </div>
                )}
                <dl className="flex flex-wrap justify-end gap-x-6 border-t border-slate-100 px-4 py-2 text-sm">
                    <span className="flex gap-2"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums text-slate-700">{money(totals.subtotal, currency)}</dd></span>
                    <span className="flex gap-2"><dt className="text-slate-500">Tax at {taxRate}%</dt><dd className="tabular-nums text-slate-700">{money(totals.taxTotal, currency)}</dd></span>
                    <span className="flex gap-2"><dt className="font-medium text-slate-700">Total</dt><dd className="font-semibold tabular-nums text-slate-900">{money(totals.total, currency)}</dd></span>
                </dl>
            </section>

            <label className="block max-w-2xl space-y-1 text-sm"><span className="text-slate-600">Note</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={!editable} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" />
            </label>

            <div className="flex flex-wrap items-center gap-2">
                {editable && <Button type="button" variant="outline" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save"}</Button>}
                {editable && <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={process}>Put on the shelf</Button>}
                {invoice.state === "PROCESSED" && (
                    <Button type="button" variant="ghost" className="text-slate-500" disabled={busy}
                        onClick={() => {
                            const reason = window.prompt("Why is this being voided? The stock comes back off the shelf.");
                            if (reason) start(async () => { const r = await voidInvoiceAction(tenant, invoice.id, reason); setStatus({ ok: r.ok, text: r.ok ? "Voided; the stock has come back off." : r.message ?? "Not voided" }); router.refresh(); });
                        }}>Void</Button>
                )}
                {status && <p className={`text-sm ${status.ok ? "text-teal-700" : "text-red-600"}`} role={status.ok ? undefined : "alert"}>{status.text}</p>}
            </div>
        </div>
    );
}
