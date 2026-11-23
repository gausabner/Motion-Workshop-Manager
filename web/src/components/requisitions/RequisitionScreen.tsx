"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Outcome, Panel, field } from "@/components/settings/council/shared";
import { Ledger, type Person } from "@/components/requisitions/Ledger";
import { Quotations, type SupplierOption } from "@/components/requisitions/Quotations";
import {
    cancelRequisitionAction,
    discardRequisitionAction,
    saveRequisitionAction,
    submitRequisitionAction,
    withdrawRequisitionAction,
} from "@/lib/requisitions/actions";
import type { RequisitionAnswer, RequisitionView } from "@/lib/requisitions/view";

/**
 * One requisition, laid out like the paper form: the header, what it asks
 * for, then the sign-off ledger, where the person whose turn it is signs in
 * the box that is theirs. Every action answers with the requisition as it now
 * stands; when the box just signed closes, the page says what happened and
 * who it waits on next, and the cursor goes there.
 */

export type Options = {
    products: { id: string; itemCode: string; description: string; costExTax: number; onHand: number }[];
    workshops: { id: string; name: string }[];
    votes: { id: string; label: string }[];
    people: Person[];
    suppliers: SupplierOption[];
};

const money = (n: number) => n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const touch = "pointer-coarse:min-h-11";
const label = "text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500";
const day = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

export function RequisitionScreen({ tenant, view: given, options, currency, timezone, me }: { tenant: string; view: RequisitionView; options: Options; currency: string; timezone: string; me: string }) {
    // The requisition the page was rendered with, until an action answers with a newer one.
    const [shown, setShown] = useState({ given, view: given, said: null as string | null, n: 0 });
    if (shown.given !== given) setShown({ given, view: given, said: null, n: 0 });
    const view = shown.view;
    const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

    // An answer replaces the requisition. One that closes the box it came from is also said at the top, where the cursor goes.
    const show = (next: RequisitionAnswer, announce = true) => {
        if (!next.view) return;
        const said = announce ? [next.message, next.view.waiting].filter(Boolean).join(". ") + "." : null;
        setShown((s) => ({ ...s, view: next.view!, said: said ?? s.said, n: s.n + (said ? 1 : 0) }));
    };
    const status = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (shown.n) status.current?.focus();
    }, [shown.n]);

    const title = view.number ? `Requisition ${view.number}` : "Draft requisition";
    const { stopped } = view.ledger;

    return (
        <div className="mx-auto max-w-5xl space-y-4 pb-24">
            <Link href={`/${tenant}/dashboard/requisitions`} className={`hit-area relative inline-flex items-center text-sm font-medium text-teal-700 hover:underline ${touch}`}>Requisitions</Link>
            <div>
                <h1 className="text-xl font-bold text-slate-900">{title}</h1>
                <p className="text-sm text-slate-600">
                    {view.kind === "STORES" ? "From stores" : "To be bought"} · raised by {view.requestedBy} · {when(view.createdAt)}
                    {view.source && (
                        <>
                            {" · split from "}
                            <Link href={`/${tenant}/dashboard/requisitions/${view.source.id}`} className="font-medium text-teal-700 hover:underline">{view.source.number ?? "its stores requisition"}</Link>
                        </>
                    )}
                </p>
                <p className="mt-1.5 text-sm">
                    <span className="font-semibold text-slate-900">{view.stateLabel}</span>
                    {view.waiting && <span className="text-slate-700"> · {view.waiting}</span>}
                </p>
            </div>

            {shown.said && (
                <div ref={status} role="status" tabIndex={-1} className="outline-none">
                    <Notice>{shown.said}</Notice>
                </div>
            )}
            {stopped && (
                <Notice title={stopped.title}>{stopped.comment && <p>“{stopped.comment}”</p>}</Notice>
            )}

            {view.can.edit ? (
                <DraftEditor key={view.state} tenant={tenant} view={view} options={options} currency={currency} onAnswer={show} />
            ) : (
                <Details view={view} currency={currency} />
            )}

            {view.kind === "PURCHASE" && (view.state === "DRAFT" || view.quotes.length > 0) && (
                <Quotations tenant={tenant} view={view} suppliers={options.suppliers} currency={currency} when={when} onAnswer={show} />
            )}

            <Ledger tenant={tenant} view={view} people={options.people} me={me} when={when} onAnswer={show} />
            <Housekeeping tenant={tenant} view={view} onAnswer={show} />
        </div>
    );
}

// ───────────────────────── the request itself ─────────────────────────

function Details({ view, currency }: { view: RequisitionView; currency: string }) {
    const bought = view.kind === "PURCHASE";
    const issuing = view.state === "APPROVED" || view.state === "AWAITING_FINALISE" || view.state === "CLOSED";
    // Approvers and stores see what the shelf holds; once it is closed, the count of the day is beside the point.
    const shelf = !bought && view.state !== "CLOSED" && view.state !== "CANCELLED" && view.state !== "REJECTED";
    return (
        <Panel wide level={2} title="What it asks for">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
                <Fact label="Charged to" value={view.charge ? `${view.charge.kind === "JOB" ? "Job" : "Vote"} ${view.charge.label}` : "Nothing yet"} />
                <Fact label="Workshop" value={view.workshop?.name ?? "—"} />
                <Fact label="Where it is wanted" value={view.location ?? "—"} />
                <Fact label="Needed by" value={view.requiredBy ? day(view.requiredBy) : "—"} />
                {view.purpose && <Fact label="What it is for" value={view.purpose} wide />}
            </dl>
            <table role="table" data-mobile="cards" className="w-full border-t border-slate-200 text-sm">
                <thead role="rowgroup">
                    <tr role="row" className={`text-left ${label}`}>
                        <th role="columnheader" scope="col" className="px-4 py-2 font-semibold">Item</th>
                        <th role="columnheader" scope="col" className="py-2 pr-3 text-right font-semibold">Qty</th>
                        <th role="columnheader" scope="col" className="py-2 pr-3 text-right font-semibold">Rate</th>
                        <th role="columnheader" scope="col" className="py-2 pr-3 text-right font-semibold">Value</th>
                        {shelf && <th role="columnheader" scope="col" className="py-2 pr-3 text-right font-semibold">On hand</th>}
                        {issuing && bought && <th role="columnheader" scope="col" className="py-2 pr-3 text-right font-semibold">Arrived</th>}
                        {issuing && <th role="columnheader" scope="col" className="py-2 pr-4 text-right font-semibold">{bought ? "Handed over" : "Issued"}</th>}
                    </tr>
                </thead>
                <tbody role="rowgroup">
                    {view.lines.map((l) => (
                        <tr role="row" key={l.id} className="border-t border-slate-100 align-baseline">
                            <td role="cell" data-mobile="primary" className="px-4 py-2 text-slate-900">
                                {l.itemCode && <span className="mr-2 tabular-nums text-xs font-normal text-slate-600">{l.itemCode}</span>}
                                {l.description}
                                {!l.stocked && !bought && <span className="block text-xs font-normal text-slate-600">Not a stock item: it has to be bought.</span>}
                                {l.moved > 0 && <span className="block text-xs font-normal text-slate-600">{l.moved} bought instead, on a purchase requisition.</span>}
                                {l.note && <span className="block text-xs font-normal text-slate-600">{l.note}</span>}
                            </td>
                            <td role="cell" data-label="Qty" className="py-2 pr-3 text-right tabular-nums">{l.quantity}</td>
                            <td role="cell" data-label="Rate" className="py-2 pr-3 text-right tabular-nums text-slate-600">{money(l.unitCost)}</td>
                            <td role="cell" data-label="Value" className="py-2 pr-3 text-right tabular-nums">{money(l.quantity * l.unitCost)}</td>
                            {shelf && <td role="cell" data-label="On hand" className={`py-2 pr-3 text-right tabular-nums ${l.onHand !== null && l.onHand < l.outstanding ? "font-semibold text-amber-700" : "text-slate-600"}`}>{l.onHand ?? "—"}</td>}
                            {issuing && bought && <td role="cell" data-label="Arrived" className="py-2 pr-3 text-right tabular-nums">{l.received} of {l.quantity}</td>}
                            {issuing && (
                                <td role="cell" data-label={bought ? "Handed over" : "Issued"} className="py-2 pr-4 text-right tabular-nums">
                                    {bought || l.stocked ? `${l.issued} of ${l.quantity - l.moved}` : l.moved >= l.quantity ? "Bought instead" : "To be bought"}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="border-t border-slate-200 px-4 py-2 text-right text-sm font-semibold tabular-nums text-slate-900">
                {currency} {money(view.value)} <span className="font-normal text-slate-600">excl. VAT</span>
            </p>
        </Panel>
    );
}

function Fact({ label: name, value, wide = false }: { label: string; value: string; wide?: boolean }) {
    return (
        <div className={wide ? "sm:col-span-2" : undefined}>
            <dt className={label}>{name}</dt>
            <dd className="text-slate-900">{value}</dd>
        </div>
    );
}

type DraftLine = { key: string; productId: string | null; itemCode: string; description: string; quantity: string; unitCost: string; note: string };

/** A figure as typed: a decimal comma is a decimal point; blank is nothing yet. */
const figure = (s: string) => {
    const t = s.trim().replace(",", ".");
    return t === "" ? NaN : Number(t);
};

function DraftEditor({ tenant, view, options, currency, onAnswer }: { tenant: string; view: RequisitionView; options: Options; currency: string; onAnswer: (a: RequisitionAnswer, announce?: boolean) => void }) {
    const blankLine = (n: number): DraftLine => ({ key: `new-${n}-${Date.now()}`, productId: null, itemCode: "", description: "", quantity: "1", unitCost: "", note: "" });
    const [lines, setLines] = useState<DraftLine[]>(() =>
        view.lines.length
            ? view.lines.map((l) => ({ key: l.id, productId: l.productId, itemCode: l.itemCode ?? "", description: l.description, quantity: String(l.quantity), unitCost: String(l.unitCost), note: l.note ?? "" }))
            : [blankLine(0)],
    );
    const [dirty, setDirty] = useState(false);
    const [checked, setChecked] = useState(false);
    const form = useRef<HTMLFormElement>(null);

    const byCode = useMemo(() => new Map(options.products.map((p) => [p.itemCode.toLowerCase(), p])), [options.products]);
    const change = (key: string, patch: Partial<DraftLine>) => {
        setDirty(true);
        setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    };
    const pick = (key: string, code: string) => {
        const p = byCode.get(code.trim().toLowerCase());
        change(key, p ? { itemCode: p.itemCode, productId: p.id, description: p.description, unitCost: String(p.costExTax) } : { itemCode: code, productId: null });
    };

    // What is wrong with each line, said beside it. A figure that is not a number shows at once; a missing estimate once somebody tries to submit.
    const wanted = lines.filter((l) => l.description.trim());
    type LineError = { quantity?: string; unitCost?: string; estimate?: string };
    const errors = new Map<string, LineError>();
    for (const l of wanted) {
        const q = figure(l.quantity);
        const r = l.unitCost.trim() === "" ? 0 : figure(l.unitCost);
        const e: LineError = {};
        if (!Number.isFinite(q) || q <= 0) e.quantity = "Enter a quantity above nothing, as a number.";
        if (!Number.isFinite(r) || r < 0) e.unitCost = "Enter the rate as a number.";
        else if (!l.productId && r === 0) e.estimate = "Give an estimated rate. It is not a stock item, so the approvers need to see what it will cost.";
        if (e.quantity || e.unitCost || e.estimate) errors.set(l.key, e);
    }
    // A missing estimate stops the submission, not the saving of a draft.
    const blocksSave = [...errors.values()].some((e) => e.quantity || e.unitCost);
    const total = wanted.reduce((sum, l) => sum + (figure(l.quantity) || 0) * (figure(l.unitCost) || 0), 0);
    const payload = JSON.stringify(wanted.map((l) => ({ productId: l.productId, description: l.description, quantity: figure(l.quantity) || 0, unitCost: figure(l.unitCost) || 0, note: l.note || null })));
    const chargeValue = view.charge ? `${view.charge.kind}:${view.charge.id}` : "";
    const toBuy = wanted.filter((l) => !l.productId);

    const [saved, save, saving] = useActionState(async (prev: RequisitionAnswer, formData: FormData) => {
        const result = await saveRequisitionAction(tenant, view.id, prev, formData);
        if (result.ok) setDirty(false);
        onAnswer(result, false);
        return result;
    }, {} as RequisitionAnswer);
    // Submitting saves first when there is anything unsaved, so it is one press either way.
    const [submitted, submit, submitting] = useActionState(async () => {
        if (dirty) {
            const result = await saveRequisitionAction(tenant, view.id, {}, new FormData(form.current!));
            if (!result.ok) return result;
            setDirty(false);
        }
        const result = await submitRequisitionAction(tenant, view.id);
        onAnswer(result);
        return result;
    }, {} as RequisitionAnswer);

    return (
        <Panel wide level={2} title="What it asks for">
            <form
                ref={form}
                action={save}
                onChange={() => setDirty(true)}
                onSubmit={(e) => {
                    setChecked(true);
                    if (blocksSave) e.preventDefault();
                }}
                className="space-y-3 px-4 py-3"
            >
                <input type="hidden" name="lines" value={payload} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                        Charged to
                        <select name="charge" defaultValue={chargeValue} className={`${field} font-normal ${touch}`}>
                            <option value="">Choose a job or a vote</option>
                            {view.charge?.kind === "JOB" && <option value={chargeValue}>Job {view.charge.label}</option>}
                            {options.votes.map((v) => <option key={v.id} value={`VOTE:${v.id}`}>Vote {v.label}</option>)}
                        </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                        Workshop asking
                        <select name="workshopId" defaultValue={view.workshop?.id ?? ""} className={`${field} font-normal ${touch}`}>
                            <option value="">Choose the workshop</option>
                            {options.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                        Where it is wanted
                        <input name="location" defaultValue={view.location ?? ""} maxLength={80} placeholder="Bay 2" className={`${field} font-normal ${touch}`} />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700">
                        Needed by
                        <input type="date" name="requiredBy" defaultValue={view.requiredBy ?? ""} className={`${field} font-normal ${touch}`} />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
                        What it is for
                        <input name="purpose" defaultValue={view.purpose ?? ""} maxLength={200} className={`${field} font-normal ${touch}`} />
                    </label>
                </div>

                <fieldset className="min-w-0 space-y-2 border-t border-slate-200 pt-3">
                    <legend className="text-xs font-semibold text-slate-900">Items</legend>
                    {/* Wide: one row per line under its column names. A phone: the item on top, then its quantity and rate, each named. */}
                    <div aria-hidden className={`hidden gap-2 sm:grid sm:grid-cols-[8rem_minmax(0,1fr)_5rem_7rem_2rem] ${label}`}>
                        <span>Item code</span>
                        <span>Description</span>
                        <span className="text-right">Qty</span>
                        <span className="text-right">Rate, {currency}</span>
                        <span />
                    </div>
                    {lines.map((l, n) => {
                        const product = l.productId ? options.products.find((p) => p.id === l.productId) : null;
                        const found = errors.get(l.key);
                        const e = found && { quantity: found.quantity, unitCost: found.unitCost ?? (checked ? found.estimate : undefined) };
                        const wrong = e?.quantity ?? e?.unitCost;
                        const hint = `line-${l.key}-hint`;
                        const say = wrong ?? (product ? `${product.onHand} on hand in stores` : l.description && view.kind === "STORES" ? "Not a stock item: it has to be bought, so stores cannot issue it." : "");
                        return (
                            <div key={l.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 border-b border-slate-100 pb-2 sm:grid-cols-[8rem_minmax(0,1fr)_5rem_7rem_2rem]">
                                <input list="requisition-items" value={l.itemCode} onChange={(ev) => change(l.key, { itemCode: ev.target.value })} onBlur={(ev) => pick(l.key, ev.target.value)} placeholder="Item code" aria-label={`Item code, line ${n + 1}`} aria-describedby={hint} className={`${field} col-span-2 w-full min-w-0 tabular-nums sm:col-span-1 ${touch}`} />
                                <input value={l.description} onChange={(ev) => change(l.key, { description: ev.target.value })} placeholder="What is needed" aria-label={`Description, line ${n + 1}`} className={`${field} col-span-3 w-full min-w-0 max-sm:row-start-2 sm:col-span-1 ${touch}`} />
                                <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700 max-sm:row-start-3">
                                    <span aria-hidden className="sm:sr-only">Qty</span>
                                    <input value={l.quantity} onChange={(ev) => change(l.key, { quantity: ev.target.value })} inputMode="decimal" aria-label={`Quantity, line ${n + 1}`} aria-invalid={!!e?.quantity} aria-describedby={hint} className={`${field} w-full min-w-0 text-right font-normal tabular-nums aria-invalid:border-red-700 ${touch}`} />
                                </label>
                                <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-700 max-sm:row-start-3 sm:col-span-1">
                                    <span aria-hidden className="sm:sr-only">Rate, {currency}</span>
                                    <input value={l.unitCost} onChange={(ev) => change(l.key, { unitCost: ev.target.value })} inputMode="decimal" placeholder="0.00" aria-label={`Rate, line ${n + 1}`} aria-invalid={!!e?.unitCost} aria-describedby={hint} className={`${field} w-full min-w-0 text-right font-normal tabular-nums aria-invalid:border-red-700 ${touch}`} />
                                </label>
                                <button type="button" onClick={() => { setDirty(true); setLines((all) => all.filter((x) => x.key !== l.key)); }} aria-label={`Remove line ${n + 1}`} className={`hit-area relative inline-flex size-8 items-center justify-center justify-self-end rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 max-sm:col-start-3 max-sm:row-start-1 ${touch}`}>
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                                <p id={hint} className={`col-span-full text-xs ${wrong ? "text-red-700" : "text-slate-600"}`}>{say}</p>
                            </div>
                        );
                    })}
                    <datalist id="requisition-items">
                        {options.products.map((p) => <option key={p.id} value={p.itemCode}>{p.description}</option>)}
                    </datalist>
                    <Button type="button" size="sm" variant="ghost" className={`h-9 ${touch}`} onClick={() => { setDirty(true); setLines((all) => [...all, blankLine(all.length)]); }}>
                        <Plus className="mr-1 h-4 w-4" aria-hidden />Add an item
                    </Button>
                </fieldset>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-3">
                    <p className="mr-auto text-sm">
                        <span className="font-semibold tabular-nums text-slate-900">{currency} {money(total)}</span> <span className="text-slate-600">excl. VAT</span>
                        {view.overLimitAt !== null && (
                            <span className="block text-xs text-slate-600">
                                {total >= view.overLimitAt ? "At this value the over-limit approver signs too." : `From ${currency} ${money(view.overLimitAt)} the over-limit approver signs too.`}
                            </span>
                        )}
                    </p>
                    <Outcome state={saved} />
                    <Button type="submit" size="sm" variant="outline" className={`h-9 ${touch}`} disabled={saving || submitting}>{saving ? "Saving…" : "Save draft"}</Button>
                </div>
            </form>
            {view.can.submit && (
                <form
                    action={submit}
                    onSubmit={(e) => {
                        setChecked(true);
                        if (errors.size) e.preventDefault();
                    }}
                    className="space-y-2 border-t border-slate-200 px-4 py-3"
                >
                    {toBuy.length > 0 && view.kind === "STORES" && (
                        <p className="text-xs text-slate-700">
                            {toBuy.length === 1 ? `“${toBuy[0].description}” is not a stock item.` : `${toBuy.length} lines are not stock items.`} Stores issues the rest; this requisition stays open until {toBuy.length === 1 ? "that line is" : "they are"} bought.
                        </p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {checked && errors.size > 0 && <p role="alert" className="mr-auto text-xs text-red-700">Correct the marked lines first.</p>}
                        <Outcome state={submitted} />
                        <Button type="submit" size="sm" className={`h-9 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={submitting || saving}>{submitting ? "Submitting…" : dirty ? "Save and submit" : "Submit for approval"}</Button>
                    </div>
                </form>
            )}
        </Panel>
    );
}

// ───────────────────────── withdrawing, cancelling, discarding ─────────────────────────

function Housekeeping({ tenant, view, onAnswer }: { tenant: string; view: RequisitionView; onAnswer: (a: RequisitionAnswer) => void }) {
    const [withdrawn, withdraw, withdrawing] = useActionState(async () => {
        const r = await withdrawRequisitionAction(tenant, view.id);
        onAnswer(r);
        return r;
    }, {} as RequisitionAnswer);
    const [cancelled, cancel, cancelling] = useActionState(async (prev: RequisitionAnswer, formData: FormData) => {
        const r = await cancelRequisitionAction(tenant, view.id, prev, formData);
        onAnswer(r);
        return r;
    }, {} as RequisitionAnswer);
    const [discarded, discard, discarding] = useActionState(() => discardRequisitionAction(tenant, view.id), {} as RequisitionAnswer);
    const [open, setOpen] = useState<"cancel" | "discard" | null>(null);
    if (!view.can.withdraw && !view.can.cancel && !view.can.discard) return null;
    return (
        <div className="flex flex-wrap items-center gap-2">
            {view.can.withdraw && (
                <form action={withdraw}><Button type="submit" size="sm" variant="ghost" className={`h-9 ${touch}`} disabled={withdrawing}>Withdraw to change it</Button></form>
            )}
            {view.can.discard &&
                (open === "discard" ? (
                    <form action={discard} className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-slate-700">Discard this draft? It has no number yet, so nothing leaves the register.</span>
                        <Button type="submit" size="sm" variant="outline" className={`h-9 ${touch}`} disabled={discarding}>Discard it</Button>
                        <Button type="button" size="sm" variant="ghost" className={`h-9 ${touch}`} onClick={() => setOpen(null)}>Keep it</Button>
                    </form>
                ) : (
                    <Button type="button" size="sm" variant="ghost" className={`h-9 text-slate-700 ${touch}`} onClick={() => setOpen("discard")}>Discard this draft…</Button>
                ))}
            {view.can.cancel &&
                (open === "cancel" ? (
                    <form action={cancel} className="flex flex-wrap items-center gap-2">
                        <input name="reason" required placeholder="Why it is cancelled" aria-label="Reason for cancelling" maxLength={200} className={`${field} w-64 max-w-full ${touch}`} />
                        <Button type="submit" size="sm" variant="outline" className={`h-9 ${touch}`} disabled={cancelling}>Cancel the requisition</Button>
                        <Button type="button" size="sm" variant="ghost" className={`h-9 ${touch}`} onClick={() => setOpen(null)}>Keep it</Button>
                    </form>
                ) : (
                    <Button type="button" size="sm" variant="ghost" className={`h-9 text-slate-700 ${touch}`} onClick={() => setOpen("cancel")}>Cancel…</Button>
                ))}
            <Outcome state={withdrawn} />
            <Outcome state={cancelled} />
            <Outcome state={discarded} />
        </div>
    );
}
