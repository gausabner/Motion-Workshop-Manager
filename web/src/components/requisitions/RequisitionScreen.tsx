"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Outcome, Panel, field } from "@/components/settings/council/shared";
import {
    cancelRequisitionAction,
    decideRequisitionAction,
    discardRequisitionAction,
    finaliseRequisitionAction,
    issueRequisitionAction,
    saveRequisitionAction,
    submitRequisitionAction,
    withdrawRequisitionAction,
} from "@/lib/requisitions/actions";
import type { RequisitionAnswer, RequisitionView } from "@/lib/requisitions/view";

/**
 * One requisition: what it asks for, where it is, and the one thing the
 * person looking may do next — write and submit it, approve it, issue it, or
 * sign it off. Laid out like the paper form: header, lines, then the
 * signatures. Every action answers with the requisition as it now stands, and
 * this shows that.
 */

export type Options = {
    products: { id: string; itemCode: string; description: string; costExTax: number; onHand: number }[];
    workshops: { id: string; name: string }[];
    votes: { id: string; label: string }[];
    people: { id: string; name: string; payNumber: string | null }[];
};

const money = (n: number) => n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const touch = "pointer-coarse:min-h-11";

export function RequisitionScreen({ tenant, view: given, options, currency, timezone, me }: { tenant: string; view: RequisitionView; options: Options; currency: string; timezone: string; me: string }) {
    // The requisition the page was rendered with, until an action answers with a newer one.
    const [shown, setShown] = useState({ given, view: given });
    if (shown.given !== given) setShown({ given, view: given });
    const view = shown.given === given ? shown.view : given;
    const show = (next: RequisitionAnswer) => next.view && setShown((s) => ({ ...s, view: next.view! }));
    const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const title = view.number ? `Requisition ${view.number}` : "New requisition";

    return (
        <div className="mx-auto max-w-5xl space-y-4 pb-24">
            <Link href={`/${tenant}/dashboard/requisitions`} className="text-sm font-medium text-teal-700 hover:underline">Requisitions</Link>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">{title}</h1>
                    <p className="text-sm text-slate-600">
                        {view.kind === "STORES" ? "From stores" : "To be bought"} · raised by {view.requestedBy} · {when(view.createdAt)}
                    </p>
                </div>
                <p className="text-sm font-medium text-slate-800">
                    {stateLabel(view)}
                    {view.waitingOn.length > 0 && <span className="block text-xs font-normal text-slate-600">Waiting on {view.waitingOn.join(", ")}</span>}
                </p>
            </div>

            {view.can.edit ? <DraftEditor key={view.state} tenant={tenant} view={view} options={options} currency={currency} onAnswer={show} /> : <Details view={view} currency={currency} />}

            {view.can.decide && <Decide tenant={tenant} view={view} onAnswer={show} />}
            {view.can.issue && <Issue tenant={tenant} view={view} people={options.people} me={me} onAnswer={show} />}
            {view.can.finalise.length > 0 && <Finalise tenant={tenant} view={view} onAnswer={show} />}

            <Trail view={view} when={when} />
            <Housekeeping tenant={tenant} view={view} onAnswer={show} />
        </div>
    );
}

function stateLabel(view: RequisitionView): string {
    const labels: Record<string, string> = {
        DRAFT: view.number ? "Returned for changes" : "Draft",
        AWAITING_FOREMAN: "Waiting for the foreman",
        AWAITING_HEAD: "Waiting for the divisional head",
        AWAITING_OVER_LIMIT: "Waiting for the over-limit approver",
        APPROVED: view.lines.some((l) => l.issued > 0) ? "Approved, partly issued" : "Approved, to be issued",
        AWAITING_FINALISE: "Issued, to be finalised",
        CLOSED: "Closed",
        REJECTED: "Rejected",
        CANCELLED: "Cancelled",
    };
    return labels[view.state];
}

// ───────────────────────── the request itself ─────────────────────────

function Details({ view, currency }: { view: RequisitionView; currency: string }) {
    const issuing = view.kind === "STORES" && (view.state === "APPROVED" || view.state === "AWAITING_FINALISE" || view.state === "CLOSED");
    return (
        <Panel wide level={2} title="What it asks for">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 py-3 text-sm sm:grid-cols-2">
                <Fact label="Charged to" value={view.charge ? `${view.charge.kind === "JOB" ? "Job" : "Vote"} ${view.charge.label}` : "Nothing yet"} />
                <Fact label="Workshop" value={view.workshop?.name ?? "—"} />
                <Fact label="Where it is wanted" value={view.location ?? "—"} />
                <Fact label="Needed by" value={view.requiredBy ?? "—"} />
                {view.purpose && <Fact label="What it is for" value={view.purpose} wide />}
            </dl>
            <table data-mobile="cards" className="w-full border-t border-slate-200 text-sm">
                <thead>
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                        <th scope="col" className="px-4 py-2 font-semibold">Item</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Qty</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Rate</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Value</th>
                        {issuing && <th scope="col" className="py-2 pr-4 text-right font-semibold">Issued</th>}
                    </tr>
                </thead>
                <tbody>
                    {view.lines.map((l) => (
                        <tr key={l.id} className="border-t border-slate-100 align-baseline">
                            <td data-mobile="primary" className="px-4 py-2 text-slate-900">
                                {l.itemCode && <span className="mr-2 tabular-nums text-xs text-slate-500">{l.itemCode}</span>}
                                {l.description}
                                {l.note && <span className="block text-xs text-slate-600">{l.note}</span>}
                            </td>
                            <td data-label="Qty" className="py-2 pr-3 text-right tabular-nums">{l.quantity}</td>
                            <td data-label="Rate" className="py-2 pr-3 text-right tabular-nums text-slate-600">{money(l.unitCost)}</td>
                            <td data-label="Value" className="py-2 pr-3 text-right tabular-nums">{money(l.quantity * l.unitCost)}</td>
                            {issuing && <td data-label="Issued" className="py-2 pr-4 text-right tabular-nums">{l.issued} of {l.quantity}</td>}
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

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
    return (
        <div className={wide ? "sm:col-span-2" : undefined}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">{label}</dt>
            <dd className="text-slate-900">{value}</dd>
        </div>
    );
}

type DraftLine = { key: string; productId: string | null; itemCode: string; description: string; quantity: string; unitCost: string; note: string };

function DraftEditor({ tenant, view, options, currency, onAnswer }: { tenant: string; view: RequisitionView; options: Options; currency: string; onAnswer: (a: RequisitionAnswer) => void }) {
    const [lines, setLines] = useState<DraftLine[]>(() =>
        view.lines.length
            ? view.lines.map((l) => ({ key: l.id, productId: l.productId, itemCode: l.itemCode ?? "", description: l.description, quantity: String(l.quantity), unitCost: String(l.unitCost), note: l.note ?? "" }))
            : [{ key: "new-0", productId: null, itemCode: "", description: "", quantity: "1", unitCost: "0", note: "" }],
    );
    const [dirty, setDirty] = useState(false);
    const [saved, save, saving] = useActionState(async (prev: RequisitionAnswer, formData: FormData) => {
        const result = await saveRequisitionAction(tenant, view.id, prev, formData);
        if (result.ok) setDirty(false);
        return result;
    }, {} as RequisitionAnswer);
    const [submitted, submit, submitting] = useActionState(() => submitRequisitionAction(tenant, view.id), {} as RequisitionAnswer);
    useEffect(() => onAnswer(saved), [saved]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => onAnswer(submitted), [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

    const byCode = useMemo(() => new Map(options.products.map((p) => [p.itemCode.toLowerCase(), p])), [options.products]);
    const change = (key: string, patch: Partial<DraftLine>) => {
        setDirty(true);
        setLines((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    };
    const pick = (key: string, code: string) => {
        const p = byCode.get(code.trim().toLowerCase());
        change(key, p ? { itemCode: p.itemCode, productId: p.id, description: p.description, unitCost: String(p.costExTax) } : { itemCode: code, productId: null });
    };
    const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
    const payload = JSON.stringify(
        lines.filter((l) => l.description.trim()).map((l) => ({ productId: l.productId, description: l.description, quantity: Number(l.quantity) || 0, unitCost: Number(l.unitCost) || 0, note: l.note || null })),
    );
    const chargeValue = view.charge ? `${view.charge.kind}:${view.charge.id}` : "";

    return (
        <Panel wide level={2} title="What it asks for">
            <form action={save} onChange={() => setDirty(true)} className="space-y-3 px-4 py-3">
                <input type="hidden" name="lines" value={payload} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                        Charged to
                        <select name="charge" defaultValue={chargeValue} className={`${field} font-normal ${touch}`}>
                            <option value="">Choose a job or a vote</option>
                            {view.charge?.kind === "JOB" && <option value={chargeValue}>Job {view.charge.label}</option>}
                            {options.votes.map((v) => <option key={v.id} value={`VOTE:${v.id}`}>Vote {v.label}</option>)}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                        Workshop asking
                        <select name="workshopId" defaultValue={view.workshop?.id ?? ""} className={`${field} font-normal ${touch}`}>
                            <option value="">Choose the workshop</option>
                            {options.workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                        Where it is wanted
                        <input name="location" defaultValue={view.location ?? ""} maxLength={80} placeholder="Bay 2" className={`${field} font-normal ${touch}`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                        Needed by
                        <input type="date" name="requiredBy" defaultValue={view.requiredBy ?? ""} className={`${field} font-normal ${touch}`} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 sm:col-span-2">
                        What it is for
                        <input name="purpose" defaultValue={view.purpose ?? ""} maxLength={200} className={`${field} font-normal ${touch}`} />
                    </label>
                </div>

                <fieldset className="space-y-2 border-t border-slate-200 pt-3">
                    <legend className="text-xs font-semibold text-slate-900">Items</legend>
                    {lines.map((l, n) => {
                        const product = l.productId ? options.products.find((p) => p.id === l.productId) : null;
                        return (
                            <div key={l.key} className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 pb-2 sm:grid-cols-[8rem_1fr_5rem_7rem_auto]">
                                <input list="requisition-items" value={l.itemCode} onChange={(e) => change(l.key, { itemCode: e.target.value })} onBlur={(e) => pick(l.key, e.target.value)} placeholder="Item code" aria-label={`Item code, line ${n + 1}`} className={`${field} tabular-nums ${touch}`} />
                                <input value={l.description} onChange={(e) => change(l.key, { description: e.target.value })} placeholder="What is needed" aria-label={`Description, line ${n + 1}`} className={`${field} col-span-2 sm:col-span-1 ${touch}`} />
                                <input value={l.quantity} onChange={(e) => change(l.key, { quantity: e.target.value })} inputMode="decimal" aria-label={`Quantity, line ${n + 1}`} className={`${field} text-right tabular-nums ${touch}`} />
                                <input value={l.unitCost} onChange={(e) => change(l.key, { unitCost: e.target.value })} inputMode="decimal" aria-label={`Rate, line ${n + 1}`} className={`${field} text-right tabular-nums ${touch}`} />
                                <button type="button" onClick={() => { setDirty(true); setLines((all) => all.filter((x) => x.key !== l.key)); }} aria-label={`Remove line ${n + 1}`} className={`hit-area relative inline-flex size-8 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${touch}`}>
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                                <p className="col-span-full text-xs text-slate-600">
                                    {product ? `${product.onHand} on hand in stores` : l.description ? "Not a stock item: stores cannot issue it, so it will be bought." : ""}
                                </p>
                            </div>
                        );
                    })}
                    <datalist id="requisition-items">
                        {options.products.map((p) => <option key={p.id} value={p.itemCode}>{p.description}</option>)}
                    </datalist>
                    <Button type="button" size="sm" variant="ghost" className={`h-8 ${touch}`} onClick={() => { setDirty(true); setLines((all) => [...all, { key: `new-${all.length}-${Date.now()}`, productId: null, itemCode: "", description: "", quantity: "1", unitCost: "0", note: "" }]); }}>
                        <Plus className="mr-1 h-4 w-4" aria-hidden />Add an item
                    </Button>
                </fieldset>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-3">
                    <span className="mr-auto text-sm font-semibold tabular-nums text-slate-900">{currency} {money(total)} <span className="font-normal text-slate-600">excl. VAT</span></span>
                    <Outcome state={saved} />
                    <Button type="submit" size="sm" variant="outline" className={`h-8 ${touch}`} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </div>
            </form>
            {view.can.submit && (
                <form action={submit} className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-4 py-3">
                    {dirty && <span className="mr-auto text-xs text-slate-600">Save your changes before submitting.</span>}
                    <Outcome state={submitted} />
                    <Button type="submit" size="sm" className={`h-8 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={submitting || dirty}>{submitting ? "Submitting…" : "Submit for approval"}</Button>
                </form>
            )}
        </Panel>
    );
}

// ───────────────────────── the next move ─────────────────────────

function Decide({ tenant, view, onAnswer }: { tenant: string; view: RequisitionView; onAnswer: (a: RequisitionAnswer) => void }) {
    const [state, action, pending] = useActionState(decideRequisitionAction.bind(null, tenant, view.id), {} as RequisitionAnswer);
    useEffect(() => onAnswer(state), [state]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <Panel wide level={2} title={`Your signature: ${view.can.decide!.step}`}>
            <form action={action} className="space-y-3 px-4 py-3">
                <input name="comment" placeholder="Comment (needed to return or reject it)" aria-label="Comment" maxLength={300} className={`${field} w-full ${touch}`} />
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" name="decision" value="APPROVED" size="sm" className={`h-8 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>Approve</Button>
                    <Button type="submit" name="decision" value="RETURNED" size="sm" variant="outline" className={`h-8 ${touch}`} disabled={pending}>Return for changes</Button>
                    <Button type="submit" name="decision" value="REJECTED" size="sm" variant="ghost" className={`h-8 text-slate-600 hover:text-red-700 ${touch}`} disabled={pending}>Reject</Button>
                    <Outcome state={state} />
                </div>
            </form>
        </Panel>
    );
}

function Issue({ tenant, view, people, me, onAnswer }: { tenant: string; view: RequisitionView; people: Options["people"]; me: string; onAnswer: (a: RequisitionAnswer) => void }) {
    const [state, action, pending] = useActionState(issueRequisitionAction.bind(null, tenant, view.id), {} as RequisitionAnswer);
    const [someoneElse, setSomeoneElse] = useState(false);
    useEffect(() => onAnswer(state), [state]); // eslint-disable-line react-hooks/exhaustive-deps
    const open = view.lines.filter((l) => l.outstanding > 0);
    return (
        <Panel wide level={2} title="Issue from stores" footer={view.charge?.kind === "JOB" ? `What is issued goes onto job ${view.charge.label} at cost, and comes off the shelf once.` : "What is issued comes off the shelf, charged to the vote."}>
            <form action={action} className="space-y-3 px-4 py-3">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                            <th scope="col" className="pb-1 font-semibold">Item</th>
                            <th scope="col" className="pb-1 text-right font-semibold">On hand</th>
                            <th scope="col" className="pb-1 text-right font-semibold">Still to issue</th>
                            <th scope="col" className="pb-1 text-right font-semibold">Issue now</th>
                        </tr>
                    </thead>
                    <tbody>
                        {open.map((l) => (
                            <tr key={l.id} className="border-t border-slate-100 align-middle">
                                <td className="py-1.5 pr-3 text-slate-900">{l.description}{!l.stocked && <span className="block text-xs text-slate-600">Not a stock item: to be bought.</span>}</td>
                                <td className={`py-1.5 pr-3 text-right tabular-nums ${l.onHand !== null && l.onHand < l.outstanding ? "font-semibold text-amber-700" : "text-slate-600"}`}>{l.onHand ?? "—"}</td>
                                <td className="py-1.5 pr-3 text-right tabular-nums">{l.outstanding}</td>
                                <td className="py-1.5 text-right">
                                    <input name={`issue:${l.id}`} defaultValue={l.stocked ? String(l.outstanding) : "0"} disabled={!l.stocked} inputMode="decimal" aria-label={`Issue now: ${l.description}`} className={`${field} w-20 text-right tabular-nums ${touch}`} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-3">
                    {someoneElse ? (
                        <>
                            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">Receiver&rsquo;s name<input name="receiverName" required className={`${field} w-56 font-normal ${touch}`} /></label>
                            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">Pay No.<input name="receiverPayNumber" className={`${field} w-28 font-normal tabular-nums ${touch}`} /></label>
                        </>
                    ) : (
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
                            Received by
                            <select name="receiverId" required defaultValue="" className={`${field} w-64 font-normal ${touch}`}>
                                <option value="" disabled>Choose who takes the parts</option>
                                {people.filter((p) => p.id !== me).map((p) => <option key={p.id} value={p.id}>{p.name}{p.payNumber ? ` · ${p.payNumber}` : ""}</option>)}
                            </select>
                        </label>
                    )}
                    <button type="button" onClick={() => setSomeoneElse((v) => !v)} className={`text-sm font-medium text-teal-700 hover:underline ${touch}`}>{someoneElse ? "Choose from the team" : "Someone without a login"}</button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" size="sm" className={`h-8 bg-teal-700 hover:bg-teal-800 ${touch}`} disabled={pending}>{pending ? "Issuing…" : "Issue"}</Button>
                    <Outcome state={state} />
                </div>
            </form>
        </Panel>
    );
}

function Finalise({ tenant, view, onAnswer }: { tenant: string; view: RequisitionView; onAnswer: (a: RequisitionAnswer) => void }) {
    const [state, action, pending] = useActionState(finaliseRequisitionAction.bind(null, tenant, view.id), {} as RequisitionAnswer);
    useEffect(() => onAnswer(state), [state]); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <Panel wide level={2} title="Finalise" footer="The foreman, the fleet coordinator and the divisional head sign to close it; whoever fitted the parts may sign too. One person signs one box.">
            <form action={action} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <input name="comment" placeholder="Comment (optional)" aria-label="Comment" maxLength={300} className={`${field} w-64 min-w-0 ${touch}`} />
                {view.can.finalise.map((f) => (
                    <Button key={f.step} type="submit" name="step" value={f.step} size="sm" variant="outline" className={`h-8 ${touch}`} disabled={pending}>Sign as {f.label.toLowerCase()}</Button>
                ))}
                <Outcome state={state} />
            </form>
        </Panel>
    );
}

// ───────────────────────── the record ─────────────────────────

function Trail({ view, when }: { view: RequisitionView; when: (iso: string) => string }) {
    if (!view.signoffs.length && !view.issues.length) return null;
    const said: Record<string, string> = { SUBMITTED: "Submitted", APPROVED: "Approved", RETURNED: "Returned", REJECTED: "Rejected", CANCELLED: "Cancelled", SIGNED: "Signed", WITNESSED: "Witnessed", RAISED_BY_FOREMAN: "Raised by the foreman" };
    return (
        <Panel wide level={2} title="Signatures and handovers" footer="Each signature keeps the name and pay number as they stood when it was given.">
            <table data-mobile="cards" className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                        <th scope="col" className="px-4 py-2 font-semibold">Box</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Name</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Pay No.</th>
                        <th scope="col" className="py-2 pr-4 text-right font-semibold">Time</th>
                    </tr>
                </thead>
                <tbody>
                    {[
                        ...view.signoffs.map((s) => ({ at: s.at, key: s.id, box: s.role, name: s.name, payNumber: s.payNumber, note: [said[s.decision] ?? s.decision, s.comment].filter(Boolean).join(" · ") })),
                        ...view.issues.map((i) => ({ at: i.at, key: i.id, box: "Received from stores", name: i.receiverName, payNumber: i.receiverPayNumber, note: `${i.lines.map((l) => `${l.quantity} × ${l.description}`).join("; ")} · issued by ${i.issuedBy}` })),
                    ]
                        .sort((a, b) => a.at.localeCompare(b.at))
                        .map((r) => (
                            <tr key={r.key} className="border-t border-slate-100 align-baseline">
                                <td className="px-4 py-1.5 text-slate-600 max-md:text-[11px] max-md:font-semibold max-md:uppercase max-md:tracking-[0.05em]">{r.box}</td>
                                <td data-mobile="primary" className="py-1.5 pr-3 font-medium text-slate-900">{r.name}<span className="block text-xs font-normal text-slate-600">{r.note}</span></td>
                                <td data-label="Pay No." className="py-1.5 pr-3 tabular-nums text-slate-600">{r.payNumber ?? "—"}</td>
                                <td data-label="Signed" className="py-1.5 pr-4 tabular-nums text-xs text-slate-500 md:text-right">{when(r.at)}</td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </Panel>
    );
}

function Housekeeping({ tenant, view, onAnswer }: { tenant: string; view: RequisitionView; onAnswer: (a: RequisitionAnswer) => void }) {
    const [withdrawn, withdraw, withdrawing] = useActionState(() => withdrawRequisitionAction(tenant, view.id), {} as RequisitionAnswer);
    const [cancelled, cancel, cancelling] = useActionState(cancelRequisitionAction.bind(null, tenant, view.id), {} as RequisitionAnswer);
    const [discarded, discard, discarding] = useActionState(() => discardRequisitionAction(tenant, view.id), {} as RequisitionAnswer);
    const [cancelOpen, setCancelOpen] = useState(false);
    useEffect(() => onAnswer(withdrawn), [withdrawn]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => onAnswer(cancelled), [cancelled]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!view.can.withdraw && !view.can.cancel && !view.can.discard) return null;
    return (
        <div className="flex flex-wrap items-center gap-2">
            {view.can.withdraw && (
                <form action={withdraw}><Button type="submit" size="sm" variant="ghost" className={`h-8 ${touch}`} disabled={withdrawing}>Withdraw to change it</Button></form>
            )}
            {view.can.discard && (
                <form action={discard}><Button type="submit" size="sm" variant="ghost" className={`h-8 text-slate-600 ${touch}`} disabled={discarding}>Discard this draft</Button></form>
            )}
            {view.can.cancel &&
                (cancelOpen ? (
                    <form action={cancel} className="flex flex-wrap items-center gap-2">
                        <input name="reason" required placeholder="Why it is cancelled" aria-label="Reason for cancelling" maxLength={200} className={`${field} w-64 ${touch}`} />
                        <Button type="submit" size="sm" variant="outline" className={`h-8 ${touch}`} disabled={cancelling}>Cancel the requisition</Button>
                        <Button type="button" size="sm" variant="ghost" className={`h-8 ${touch}`} onClick={() => setCancelOpen(false)}>Keep it</Button>
                    </form>
                ) : (
                    <Button type="button" size="sm" variant="ghost" className={`h-8 text-slate-600 ${touch}`} onClick={() => setCancelOpen(true)}>Cancel…</Button>
                ))}
            <Outcome state={withdrawn} />
            <Outcome state={cancelled} />
            <Outcome state={discarded} />
        </div>
    );
}
