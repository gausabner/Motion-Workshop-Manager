"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { costTotals } from "@/lib/purchasing/rules";
import { saveOrderAction, setOrderStateAction, receiveOrderAction } from "@/lib/purchasing/actions";
import type { OrderRecord } from "@/lib/purchasing/queries";
import { money } from "@/lib/format";

type Options = { suppliers: { id: string; companyName: string }[]; products: { id: string; itemCode: string; description: string; cost: number; price: number; requiresSerial?: boolean }[]; jobs: { id: string; label: string }[] };
type Line = { key: string; id?: string; productId: string; description: string; quantity: number; unitCost: number; documentId: string; dueDate: string; received: number };

const cell = "h-8 w-full rounded-sm border border-slate-200 bg-white px-2 text-sm disabled:bg-slate-50 disabled:text-slate-500";
const numCell = `${cell} text-right tabular-nums`;
let seq = 0;
const blank = (): Line => ({ key: `n${++seq}`, productId: "", description: "", quantity: 1, unitCost: 0, documentId: "", dueDate: "", received: 0 });

/** What we are asking a supplier for, line by line, with the job each line is for. */
export function OrderEditor({ tenant, order, options, currency, taxRate, today }: { tenant: string; order: OrderRecord | null; options: Options; currency: string; taxRate: number; today: string }) {
    const router = useRouter();
    const editable = !order || (order.state !== "CANCELLED" && order.state !== "RECEIVED" && (order.state === "SUGGESTED" || !order.anyReceived));
    const [supplierId, setSupplierId] = useState(order?.supplier.id ?? options.suppliers[0]?.id ?? "");
    // The workshop's own date, handed in by the server: reading the clock here makes the first render differ from the server's.
    const [orderDate, setOrderDate] = useState(order?.orderDate ?? today);
    const [dueDate, setDueDate] = useState(order?.dueDate ?? "");
    const [reference, setReference] = useState(order?.reference ?? "");
    const [note, setNote] = useState(order?.note ?? "");
    const [lines, setLines] = useState<Line[]>(
        order?.lines.length
            ? order.lines.map((l) => ({ key: l.id, id: l.id, productId: l.productId ?? "", description: l.description, quantity: l.quantity, unitCost: l.unitCost, documentId: l.documentId ?? "", dueDate: l.dueDate ?? "", received: l.received }))
            : [blank()],
    );
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, start] = useTransition();

    const totals = costTotals(lines.map((l) => ({ quantity: l.quantity, unitCost: l.unitCost })), { taxRate, pricesIncludeTax: false });
    const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...patch } : l)));

    function pickProduct(i: number, productId: string) {
        const product = options.products.find((p) => p.id === productId);
        set(i, { productId, ...(product ? { description: lines[i].description || product.description, unitCost: lines[i].unitCost || product.cost } : {}) });
    }

    function save(then?: (id: string) => void) {
        setStatus(null);
        start(async () => {
            const result = await saveOrderAction(tenant, order?.id ?? null, {
                supplierId, orderDate, dueDate, reference, note,
                lines: lines.map((l) => ({ id: l.id, productId: l.productId || null, description: l.description, quantity: l.quantity, unitCost: l.unitCost, documentId: l.documentId || null, dueDate: l.dueDate })),
            });
            if (!result.ok) {
                setStatus({ ok: false, text: result.message });
                return;
            }
            setStatus({ ok: true, text: "Saved" });
            if (then) then(result.id);
            else if (!order) router.push(`/${tenant}/dashboard/purchasing/orders/${result.id}`);
            else router.refresh();
        });
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
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Order date</span><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} disabled={!editable} className={`${cell} h-9`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Wanted by</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!editable} className={`${cell} h-9`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Their reference</span><input value={reference} onChange={(e) => setReference(e.target.value)} disabled={!editable} className={`${cell} h-9`} /></label>
                </div>
            </section>

            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="hidden grid-cols-12 gap-2 border-b bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 md:grid">
                    <span className="col-span-3">Product</span><span className="col-span-2">Description</span><span className="col-span-1 text-right">Qty</span>
                    <span className="col-span-1 text-right">Cost</span><span className="col-span-2">For job</span><span className="col-span-2">Due</span><span className="col-span-1 text-right">Total</span>
                </div>
                <ul className="divide-y divide-slate-100">
                    {lines.map((line, i) => (
                        <li key={line.key} className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                            <select value={line.productId} onChange={(e) => pickProduct(i, e.target.value)} disabled={!editable || line.received > 0} className={`${cell} col-span-12 md:col-span-3`}>
                                <option value="">Not a stocked product</option>
                                {options.products.map((p) => <option key={p.id} value={p.id}>{p.itemCode} · {p.description}</option>)}
                            </select>
                            <input value={line.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="What it is" disabled={!editable} className={`${cell} col-span-12 md:col-span-2`} />
                            <input value={line.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) || 0 })} inputMode="decimal" disabled={!editable || line.received > 0} className={`${numCell} col-span-3 md:col-span-1`} aria-label="Quantity" />
                            <input value={line.unitCost} onChange={(e) => set(i, { unitCost: Number(e.target.value) || 0 })} inputMode="decimal" disabled={!editable} className={`${numCell} col-span-3 md:col-span-1`} aria-label="Unit cost" />
                            <select value={line.documentId} onChange={(e) => set(i, { documentId: e.target.value })} disabled={!editable} className={`${cell} col-span-6 md:col-span-2`} aria-label="For job">
                                <option value="">Stock, not a job</option>
                                {options.jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                            </select>
                            <input type="date" value={line.dueDate} onChange={(e) => set(i, { dueDate: e.target.value })} disabled={!editable} className={`${cell} col-span-6 md:col-span-2`} aria-label="Line due date" />
                            <span className="col-span-12 flex items-center justify-end gap-2 text-sm tabular-nums text-slate-700 md:col-span-1">
                                <span>
                                    {money(line.quantity * line.unitCost, currency)}
                                    {line.received > 0 && <span className="block text-[10px] text-teal-700">{line.received} in</span>}
                                </span>
                                {editable && (
                                    <button type="button" onClick={() => setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, n) => n !== i)))} disabled={line.received > 0}
                                        className="p-1 text-slate-400 hover:text-red-700 disabled:opacity-30" aria-label="Remove line">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </span>
                        </li>
                    ))}
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

            <label className="block max-w-2xl space-y-1 text-sm"><span className="text-slate-600">Note for the supplier</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={!editable} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" />
            </label>

            <div className="flex flex-wrap items-center gap-2">
                {editable && <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : order ? "Save" : "Save order"}</Button>}
                {order && order.state === "SUGGESTED" && (
                    <Button type="button" variant="outline" disabled={busy} onClick={() => save(() => start(async () => { await setOrderStateAction(tenant, order.id, "ORDERED"); router.refresh(); }))}>Send to supplier</Button>
                )}
                {order && (order.state === "ORDERED" || order.state === "SUGGESTED") && order.lines.length > 0 && (
                    <form action={receiveOrderAction.bind(null, tenant, order.id)}>
                        <Button type="submit" variant="outline" disabled={busy}>Goods arrived</Button>
                    </form>
                )}
                {order && order.state !== "CANCELLED" && order.state !== "RECEIVED" && !order.anyReceived && (
                    <Button type="button" variant="ghost" className="text-slate-500" disabled={busy}
                        onClick={() => { if (window.confirm("Cancel this order?")) start(async () => { await setOrderStateAction(tenant, order.id, "CANCELLED"); router.refresh(); }); }}>Cancel order</Button>
                )}
                {status && <p className={`text-sm ${status.ok ? "text-teal-700" : "text-red-600"}`} role={status.ok ? undefined : "alert"}>{status.text}</p>}
            </div>

            {order && order.invoices.length > 0 && (
                <section className="rounded-sm border border-slate-200 bg-white">
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Received on</h2>
                    <ul className="divide-y divide-slate-100 text-sm">
                        {order.invoices.map((i) => (
                            <li key={i.id} className="flex items-center justify-between px-4 py-2">
                                <Link href={`/${tenant}/dashboard/purchasing/invoices/${i.id}`} className="text-slate-700 hover:text-teal-700">{i.supplierNumber || "Draft"}</Link>
                                <span className="tabular-nums text-slate-600">{money(i.total, currency)}</span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
