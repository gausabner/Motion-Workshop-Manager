"use client";

import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Outcome, Panel, field } from "@/components/settings/council/shared";
import { addQuoteAction, chooseQuoteAction, removeQuoteAction, requestQuotesAction, submitRequisitionAction } from "@/lib/requisitions/actions";
import type { RequisitionAnswer, RequisitionView } from "@/lib/requisitions/view";

/**
 * A purchase requisition's quotations: what each supplier quoted, the one put
 * forward for approval, and the council's rule for how many a purchase of
 * this value needs. Whoever gathers them — the requester, a parts driver or
 * stores — adds them here, with the scan, and can ask suppliers by email: one
 * link each, to the request without prices, sent from their own mail.
 */

export type SupplierOption = { id: string; name: string; email: string | null };
type Answer = (a: RequisitionAnswer, announce?: boolean) => void;

const touch = "pointer-coarse:min-h-11";
const label = "text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500";
const money = (n: number) => n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function Quotations({ tenant, view, suppliers, currency, when, onAnswer }: { tenant: string; view: RequisitionView; suppliers: SupplierOption[]; currency: string; when: (iso: string) => string; onAnswer: Answer }) {
    const have = view.quotes.length;
    const need = view.quotesRequired;
    const chosen = view.quotes.find((q) => q.chosen);
    const rule = `${have} of ${need} ${need === 1 ? "quotation" : "quotations"}`;
    const ready = have >= need && !!chosen;
    return (
        <Panel wide level={2} title="Quotations" action={<span className={`text-xs font-medium ${ready ? "text-slate-700" : "text-slate-600"}`}>{rule}</span>}>
            {have === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-600">
                    No quotations yet. A purchase of this value needs {need === 1 ? "one" : need}, and the approvers approve the one chosen.
                </p>
            ) : (
                <table role="table" data-mobile="cards" className="w-full text-sm">
                    <thead role="rowgroup">
                        <tr role="row" className={`text-left ${label}`}>
                            <th role="columnheader" scope="col" className="px-4 py-2 font-semibold">Supplier</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 text-right font-semibold">Excl. VAT, {currency}</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">Their reference</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">Valid until</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">Obtained by</th>
                            <th role="columnheader" scope="col" className="py-2 pr-4 font-semibold"><span className="sr-only">Chosen, scan and changes</span></th>
                        </tr>
                    </thead>
                    <tbody role="rowgroup">
                        {view.quotes.map((q) => (
                            <tr role="row" key={q.id} className="relative border-t border-slate-100 align-baseline">
                                <td role="cell" data-mobile="primary" className="px-4 py-2 font-medium text-slate-900">
                                    {q.chosen && <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-teal-700" />}
                                    {q.supplier}
                                    {q.chosen && <span className="ml-2 text-xs font-semibold text-teal-700">Chosen</span>}
                                    {q.note && <span className="block text-xs font-normal text-slate-600">{q.note}</span>}
                                </td>
                                <td role="cell" data-label={`Excl. VAT, ${currency}`} className="py-2 pr-3 text-right tabular-nums">{money(q.amount)}</td>
                                <td role="cell" data-label="Their reference" className="py-2 pr-3 text-slate-700">{q.reference ?? "—"}</td>
                                <td role="cell" data-label="Valid until" className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-700">{q.validUntil ? day(q.validUntil) : "—"}</td>
                                <td role="cell" data-label="Obtained by" className="py-2 pr-3 text-slate-700">{q.obtainedBy}</td>
                                <td role="cell" className="py-2 pr-4">
                                    <div className="flex flex-wrap items-center justify-end gap-2 max-md:justify-start">
                                        {q.scan && (
                                            <a href={`/${tenant}/attachments/${q.scan.id}`} target="_blank" rel="noreferrer" className={`text-xs font-medium text-teal-700 hover:underline ${touch} inline-flex items-center`}>
                                                Scan<span className="sr-only"> of {q.supplier}&rsquo;s quotation</span>
                                            </a>
                                        )}
                                        {view.can.quotes && <QuoteChanges tenant={tenant} view={view} quoteId={q.id} supplier={q.supplier} chosen={q.chosen} onAnswer={onAnswer} />}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {view.can.quotes && <AddQuote tenant={tenant} view={view} suppliers={suppliers} currency={currency} onAnswer={onAnswer} />}
            {view.can.quotes && <AskSuppliers tenant={tenant} view={view} suppliers={suppliers} when={when} onAnswer={onAnswer} />}
            {view.can.submit && !view.can.edit && <SendOn tenant={tenant} view={view} ready={ready} onAnswer={onAnswer} />}
        </Panel>
    );
}

function QuoteChanges({ tenant, view, quoteId, supplier, chosen, onAnswer }: { tenant: string; view: RequisitionView; quoteId: string; supplier: string; chosen: boolean; onAnswer: Answer }) {
    const [state, act, pending] = useActionState(async (_: RequisitionAnswer, formData: FormData) => {
        const r = String(formData.get("do")) === "remove" ? await removeQuoteAction(tenant, view.id, quoteId) : await chooseQuoteAction(tenant, view.id, quoteId);
        onAnswer(r, false);
        return r;
    }, {} as RequisitionAnswer);
    return (
        <form action={act} className="flex items-center gap-1">
            {!chosen && (
                <Button type="submit" name="do" value="choose" size="sm" variant="outline" className={`h-8 ${touch}`} disabled={pending}>
                    Choose<span className="sr-only"> {supplier}</span>
                </Button>
            )}
            <Button type="submit" name="do" value="remove" size="sm" variant="ghost" className={`h-8 text-slate-700 ${touch}`} disabled={pending}>
                Remove<span className="sr-only"> {supplier}&rsquo;s quotation</span>
            </Button>
            {!state.ok && <Outcome state={state} />}
        </form>
    );
}

function AddQuote({ tenant, view, suppliers, currency, onAnswer }: { tenant: string; view: RequisitionView; suppliers: SupplierOption[]; currency: string; onAnswer: Answer }) {
    const [key, setKey] = useState(0);
    const [state, act, pending] = useActionState(async (prev: RequisitionAnswer, formData: FormData) => {
        const r = await addQuoteAction(tenant, view.id, prev, formData);
        if (r.ok) setKey((k) => k + 1);
        onAnswer(r, false);
        return r;
    }, {} as RequisitionAnswer);
    return (
        <form key={key} action={act} className="space-y-3 border-t border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold text-slate-900">Add a quotation</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                    Supplier
                    <select name="supplierId" required defaultValue="" className={`${field} font-normal ${touch}`}>
                        <option value="" disabled>Choose the supplier</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                    Amount excl. VAT, {currency}
                    <input name="amount" required inputMode="decimal" className={`${field} text-right font-normal tabular-nums ${touch}`} />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                    Their reference
                    <input name="reference" maxLength={60} className={`${field} font-normal ${touch}`} />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                    Valid until
                    <input type="date" name="validUntil" className={`${field} font-normal ${touch}`} />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
                    Note
                    <input name="note" maxLength={200} className={`${field} font-normal ${touch}`} />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-3">
                    The quotation, scanned or photographed
                    <input type="file" name="scan" accept="image/*,application/pdf" className={`text-sm font-normal text-slate-700 file:mr-3 file:h-8 file:rounded-sm file:border file:border-slate-300 file:bg-white file:px-3 file:text-sm file:text-slate-900 ${touch}`} />
                </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" size="sm" variant="outline" className={`h-9 ${touch}`} disabled={pending}>{pending ? "Adding…" : "Add the quotation"}</Button>
                <Outcome state={state} />
            </div>
        </form>
    );
}

function AskSuppliers({ tenant, view, suppliers, when, onAnswer }: { tenant: string; view: RequisitionView; suppliers: SupplierOption[]; when: (iso: string) => string; onAnswer: Answer }) {
    const [state, act, pending] = useActionState(async (prev: RequisitionAnswer, formData: FormData) => {
        const r = await requestQuotesAction(tenant, view.id, prev, formData);
        onAnswer(r, false);
        return r;
    }, {} as RequisitionAnswer);
    const [open, setOpen] = useState(false);
    const emailable = suppliers.filter((s) => s.email);
    return (
        <div className="space-y-3 border-t border-slate-200 px-4 py-3">
            {view.asked.length > 0 && (
                <p className="text-xs text-slate-700">
                    Asked: {view.asked.map((a, i) => (
                        <span key={i}>
                            {i > 0 && "; "}
                            {a.supplier}, {when(a.at)}{a.opened ? `, opened ${a.opened === 1 ? "once" : `${a.opened} times`}` : ", not opened yet"}
                        </span>
                    ))}
                </p>
            )}
            {!open ? (
                <Button type="button" size="sm" variant="ghost" className={`h-9 ${touch}`} onClick={() => setOpen(true)}>
                    <Mail className="mr-1 h-4 w-4" aria-hidden />Ask suppliers by email
                </Button>
            ) : (
                <form action={act} className="space-y-2">
                    <fieldset className="min-w-0">
                        <legend className="text-xs font-semibold text-slate-900">Ask these suppliers for a price</legend>
                        <p className="text-xs text-slate-600">Each gets a link to the items and quantities, without prices. Suppliers without an email address are not listed.</p>
                        <div className="mt-2 grid gap-1 sm:grid-cols-2">
                            {emailable.map((s) => (
                                <label key={s.id} className={`flex items-center gap-2 text-sm text-slate-900 ${touch}`}>
                                    <input type="checkbox" name="supplierId" value={s.id} className="accent-teal-700 pointer-coarse:size-5" />
                                    {s.name} <span className="truncate text-xs text-slate-600">{s.email}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" size="sm" variant="outline" className={`h-9 ${touch}`} disabled={pending}>{pending ? "Preparing…" : "Prepare the emails"}</Button>
                        <Button type="button" size="sm" variant="ghost" className={`h-9 ${touch}`} onClick={() => setOpen(false)}>Close</Button>
                        {!state.ok && <Outcome state={state} />}
                    </div>
                </form>
            )}
            {state.ok && state.emails && state.emails.length > 0 && (
                <div role="status" className="space-y-1">
                    <p className="text-xs text-slate-700">Ready to send from your own email. Each opens a message with the link in it.</p>
                    <ul className="flex flex-wrap gap-2">
                        {state.emails.map((e) => (
                            <li key={e.email}>
                                <a href={e.href} className={`inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 px-3 text-sm font-medium text-slate-900 hover:border-teal-700 ${touch}`}>
                                    <Mail className="h-4 w-4 text-teal-700" aria-hidden />Email {e.supplier}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** Whoever gathered the quotations of a split purchase sends it for approval. */
function SendOn({ tenant, view, ready, onAnswer }: { tenant: string; view: RequisitionView; ready: boolean; onAnswer: Answer }) {
    const [state, act, pending] = useActionState(async () => {
        const r = await submitRequisitionAction(tenant, view.id);
        onAnswer(r);
        return r;
    }, {} as RequisitionAnswer);
    return (
        <form action={act} className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-4 py-3">
            {!ready && <span className="mr-auto text-xs text-slate-600">Add the quotations the rule needs, and choose one, before it goes for approval.</span>}
            <Outcome state={state} />
            <Button type="submit" size="sm" className={`h-9 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>{pending ? "Submitting…" : "Submit for approval"}</Button>
        </form>
    );
}
