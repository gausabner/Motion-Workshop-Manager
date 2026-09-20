"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { spreadOldestFirst } from "@/lib/purchasing/settlement";
import { postSupplierPaymentAction, reverseSupplierPaymentAction, saveSupplierPaymentAction } from "@/lib/purchasing/payment-actions";
import type { SupplierPaymentRecord } from "@/lib/purchasing/payments";
import { dateShort, money } from "@/lib/format";

type OpenInvoice = { id: string; supplierNumber: string; supplier: { id: string; companyName: string }; postDate: string; dueDate: string | null; total: number; outstanding: number };

const cell = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm disabled:bg-slate-50 disabled:text-slate-500";

/**
 * One payment out, across as many suppliers as it needs to cover. No tender
 * split: money going out is a single transfer, which is the asymmetry with a
 * customer receipt worth keeping.
 */
export function PaymentEditor({ tenant, payment, open, methods, currency }: {
    tenant: string; payment: SupplierPaymentRecord; open: OpenInvoice[]; methods: { id: string; name: string }[]; currency: string;
}) {
    const router = useRouter();
    const editable = payment.state === "DRAFT";
    const [postDate, setPostDate] = useState(payment.postDate);
    const [reference, setReference] = useState(payment.reference ?? "");
    const [methodId, setMethodId] = useState(payment.methodId ?? "");
    const [note, setNote] = useState(payment.note ?? "");
    const [amount, setAmount] = useState(payment.amount);
    const [applied, setApplied] = useState<Map<string, number>>(new Map(payment.allocations.map((a) => [a.supplierInvoiceId, a.amount])));
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, start] = useTransition();

    // A draft's own allocations still count towards what an invoice has left.
    const invoices: OpenInvoice[] = editable
        ? [...open, ...payment.allocations.filter((a) => !open.some((o) => o.id === a.supplierInvoiceId)).map((a) => ({
            id: a.supplierInvoiceId, supplierNumber: a.supplierNumber, supplier: a.supplier, postDate: a.postDate, dueDate: a.dueDate, total: a.total, outstanding: a.outstanding,
        }))].sort((a, b) => a.postDate.localeCompare(b.postDate))
        : payment.allocations.map((a) => ({ id: a.supplierInvoiceId, supplierNumber: a.supplierNumber, supplier: a.supplier, postDate: a.postDate, dueDate: a.dueDate, total: a.total, outstanding: a.outstanding }));

    const total = [...applied.values()].reduce((sum, v) => sum + v, 0);
    const left = Math.round((amount - total) * 100) / 100;
    const payload = () => ({
        postDate, reference, methodId, note, amount,
        allocations: [...applied].filter(([, v]) => v > 0).map(([supplierInvoiceId, value]) => ({ supplierInvoiceId, amount: value })),
    });

    const setOne = (id: string, value: number) => setApplied((m) => { const next = new Map(m); if (value > 0) next.set(id, value); else next.delete(id); return next; });

    function spread() {
        const order = invoices.map((i) => ({ id: i.id, outstanding: i.outstanding }));
        setApplied(spreadOldestFirst(amount, order));
    }

    function payAll() {
        const next = new Map(invoices.map((i) => [i.id, i.outstanding] as const));
        setApplied(next);
        setAmount(Math.round([...next.values()].reduce((s, v) => s + v, 0) * 100) / 100);
    }

    const run = (work: () => Promise<{ ok: boolean; message?: string }>) => start(async () => {
        const result = await work();
        setStatus({ ok: result.ok, text: result.message ?? (result.ok ? "Saved" : "Not saved") });
        router.refresh();
    });

    return (
        <div className="space-y-4">
            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Paid on</span><input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} disabled={!editable} className={`${cell} w-full`} /></label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Amount paid</span>
                        <input value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} inputMode="decimal" disabled={!editable} className={`${cell} w-full text-right tabular-nums`} />
                    </label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">How</span>
                        <select value={methodId} onChange={(e) => setMethodId(e.target.value)} disabled={!editable} className={`${cell} w-full`}>
                            <option value="">Not said</option>
                            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </label>
                    <label className="space-y-1 text-sm"><span className="text-slate-600">Reference on the statement</span><input value={reference} onChange={(e) => setReference(e.target.value)} disabled={!editable} className={`${cell} w-full`} /></label>
                </div>
            </section>

            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{editable ? "What it pays" : "What it paid"}</h2>
                    {editable && invoices.length > 0 && (
                        <span className="flex gap-2">
                            <Button type="button" size="sm" variant="ghost" className="h-7 text-slate-600" onClick={spread}>Spread over oldest first</Button>
                            <Button type="button" size="sm" variant="ghost" className="h-7 text-slate-600" onClick={payAll}>Pay everything owed</Button>
                        </span>
                    )}
                </div>
                {invoices.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">Nothing is owed to any supplier.</p>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {invoices.map((invoice) => {
                            const value = applied.get(invoice.id) ?? 0;
                            const overdue = invoice.dueDate && invoice.dueDate < postDate;
                            return (
                                <li key={invoice.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                                    <span className="min-w-0 flex-1">
                                        <Link href={`/${tenant}/dashboard/purchasing/invoices/${invoice.id}`} className="font-medium text-slate-800 hover:text-teal-700">{invoice.supplierNumber || "No number"}</Link>
                                        <span className="block text-xs text-slate-500">
                                            {invoice.supplier.companyName} · {dateShort(invoice.postDate)}
                                            {invoice.dueDate && <span className={overdue ? "text-amber-700" : ""}> · due {dateShort(invoice.dueDate)}</span>}
                                        </span>
                                    </span>
                                    <span className="text-right text-xs text-slate-500">
                                        <span className="block tabular-nums">{money(invoice.total, currency)}</span>
                                        <span className="block tabular-nums">{money(invoice.outstanding, currency)} left</span>
                                    </span>
                                    {editable ? (
                                        <span className="flex items-center gap-1">
                                            <input
                                                value={value || ""} onChange={(e) => setOne(invoice.id, Number(e.target.value) || 0)} inputMode="decimal" placeholder="0.00"
                                                className={`${cell} w-28 text-right tabular-nums`} aria-label={`Amount against ${invoice.supplierNumber}`}
                                            />
                                            <button type="button" onClick={() => setOne(invoice.id, invoice.outstanding)} className="rounded bg-slate-100 px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-200">All</button>
                                        </span>
                                    ) : (
                                        <span className="w-28 text-right font-medium tabular-nums text-slate-800">{money(value, currency)}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-100 px-4 py-2 text-sm">
                    <span className="text-slate-500">Applied <span className="tabular-nums text-slate-800">{money(total, currency)}</span></span>
                    <span className={left === 0 ? "text-slate-400" : "font-medium text-amber-700"}>
                        {left > 0 ? `${money(left, currency)} not yet applied` : left < 0 ? `${money(-left, currency)} more than the payment` : "Fully applied"}
                    </span>
                </div>
            </section>

            <label className="block max-w-2xl space-y-1 text-sm"><span className="text-slate-600">Note</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} disabled={!editable} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" />
            </label>

            <div className="flex flex-wrap items-center gap-2">
                {editable && <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => saveSupplierPaymentAction(tenant, payment.id, payload()))}>Save draft</Button>}
                {editable && <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={() => run(() => postSupplierPaymentAction(tenant, payment.id, payload()))}>Record the payment</Button>}
                {payment.state === "PROCESSED" && (
                    <Button type="button" variant="ghost" className="text-slate-500" disabled={busy}
                        onClick={() => { const reason = window.prompt("Why is this payment being reversed? The invoices it paid will re-open."); if (reason) run(() => reverseSupplierPaymentAction(tenant, payment.id, reason)); }}>
                        Reverse
                    </Button>
                )}
                {status && <p className={`text-sm ${status.ok ? "text-teal-700" : "text-red-600"}`} role={status.ok ? undefined : "alert"}>{status.text}</p>}
            </div>
        </div>
    );
}
