"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { Ban, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextField } from "@/components/forms/fields";
import { CustomerPicker } from "@/components/forms/CustomerPicker";
import { AllocationGrid } from "@/components/payments/AllocationGrid";
import { TenderProof, type Proof } from "@/components/payments/TenderProof";
import { customerHit } from "@/lib/search/hits";
import type { PickerHit } from "@/lib/search/types";
import { initialActionState } from "@/lib/forms";
import { paymentPostingError, unallocatedAmount } from "@/lib/documents/settlement";
import { round2 } from "@/lib/documents/totals";
import { allocationTotal, normalise, type Allocations, type OpenItem } from "@/lib/payments/allocation";
import { deleteDraftPayment, openItemsFor, processPayment, savePayment, voidPayment } from "@/lib/payments/actions";
import type { PaymentMethodOption, PaymentRecord } from "@/lib/payments/queries";
import { dateInput, money } from "@/lib/format";

/** Amounts here are magnitudes; which way the money goes is the payment's direction. */
type Tender = { key: string; id?: string; methodId: string; amount: number; received: number | null; reference: string; proof: Proof };

type Props = {
    tenant: string;
    payment: PaymentRecord;
    methods: PaymentMethodOption[];
    openItems: OpenItem[];
};

let tenderSeq = 0;
const nextKey = () => `t${++tenderSeq}`;

export function PaymentEditor({ tenant, payment, methods, openItems: initialItems }: Props) {
    const readOnly = payment.state !== "DRAFT";
    const isRefund = payment.direction === "REFUND";
    const noun = isRefund ? "refund" : "receipt";
    const sign = isRefund ? -1 : 1;
    const [state, formAction, saving] = useActionState(savePayment.bind(null, tenant, payment.id), initialActionState);

    const [customer, setCustomer] = useState<PickerHit | null>(() => (payment.customer ? customerHit(payment.customer) : null));
    const [items, setItems] = useState<OpenItem[]>(initialItems);
    const [allocations, setAllocations] = useState<Allocations>(() => Object.fromEntries(payment.allocations.map((a) => [a.documentId, a.amount])));
    const [note, setNote] = useState(payment.note ?? "");
    const [postDate, setPostDate] = useState(dateInput(payment.postDate));
    const [tenders, setTenders] = useState<Tender[]>(() => initialTenders(payment, methods));
    const [dirty, setDirty] = useState(false);
    const [voiding, setVoiding] = useState(false);
    const [loadingItems, startLoading] = useTransition();

    // Everything below works in the stored sign, so the rules that post the
    // payment and the numbers on screen are computed from the same figures.
    const signedTenders = tenders.map((t) => round2(sign * Math.abs(Number(t.amount) || 0)));
    const tendered = round2(signedTenders.reduce((sum, t) => sum + t, 0));
    const allocated = allocationTotal(allocations);
    const unallocated = unallocatedAmount(signedTenders, Object.values(allocations));
    const change = round2(tenders.reduce((sum, t) => sum + Math.max((t.received ?? 0) - Math.abs(Number(t.amount) || 0), 0), 0));
    const problem = useMemo(
        () => paymentPostingError(signedTenders, Object.values(allocations), payment.direction),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tenders, allocations, payment.direction],
    );

    // `useActionState` hands back a new object each time it runs; when a
    // successful one arrives the form and the database agree again. Adjusting
    // during render rather than in an effect avoids a second pass.
    const [seenState, setSeenState] = useState(state);
    if (seenState !== state) {
        setSeenState(state);
        if (state.ok) setDirty(false);
    }

    // Changing the customer changes the whole account, so the old allocations cannot survive it.
    const loadedFor = useRef(payment.customer?.id ?? null);
    function chooseCustomer(hit: PickerHit | null) {
        setCustomer(hit);
        setDirty(true);
        if (hit?.id === loadedFor.current) return;
        loadedFor.current = hit?.id ?? null;
        setAllocations({});
        if (!hit) {
            setItems([]);
            return;
        }
        startLoading(async () => {
            const next = await openItemsFor(tenant, hit.id);
            if (loadedFor.current === hit.id) setItems(next);
        });
    }

    const touch = <T,>(setter: (v: T) => void) => (value: T) => {
        setter(value);
        setDirty(true);
    };

    const setTender = (key: string, patch: Partial<Tender>) => {
        setTenders((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
        setDirty(true);
    };

    const errors = state.errors;
    const canPost = !readOnly && !problem && !dirty && !!customer;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-500">
                    {readOnly
                        ? payment.state === "VOID"
                            ? `This ${noun} was voided. It is kept for the audit trail.`
                            : isRefund
                                ? "Posted refunds are read-only. Void it if the money never left."
                                : "Posted receipts are read-only. Void it if the money did not arrive."
                        : "Draft — nothing lands on the account until you post it."}
                </p>
                {!readOnly && (
                    <div className="flex flex-wrap items-center gap-2">
                        <form action={processPayment.bind(null, tenant, payment.id)}>
                            <Button type="submit" size="sm" className="bg-slate-800 hover:bg-slate-900" disabled={!canPost} title={dirty ? "Save your changes first" : (problem ?? undefined)}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />{isRefund ? "Pay refund" : "Post receipt"}
                            </Button>
                        </form>
                        <form action={deleteDraftPayment.bind(null, tenant, payment.id)}>
                            <Button type="submit" size="sm" variant="ghost" className="text-slate-500 hover:text-red-700">
                                <Trash2 className="w-4 h-4 mr-1" />Discard
                            </Button>
                        </form>
                    </div>
                )}
                {payment.state === "PROCESSED" && (
                    voiding ? (
                        <form action={voidPayment.bind(null, tenant, payment.id)} className="flex items-center gap-2">
                            <input name="voidReason" required autoFocus placeholder="Reason for voiding" className="h-8 w-56 rounded-sm border border-red-300 px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500" />
                            <Button type="submit" size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">Confirm void</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setVoiding(false)}>Cancel</Button>
                        </form>
                    ) : (
                        <Button type="button" size="sm" variant="ghost" className="text-slate-500 hover:text-red-700" onClick={() => setVoiding(true)}>
                            <Ban className="w-4 h-4 mr-1" />Void
                        </Button>
                    )
                )}
            </div>

            <form action={formAction} className="space-y-4">
                <input type="hidden" name="tenders" value={JSON.stringify(tenders.map((t) => ({ ...t, key: undefined, proof: undefined, amount: Number(t.amount) || 0, tendered: t.received })))} />
                <input type="hidden" name="allocations" value={JSON.stringify(Object.entries(normalise(items, allocations)).map(([documentId, amount]) => ({ documentId, amount })))} />

                <section className="border border-slate-200 rounded-sm bg-white">
                    <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{isRefund ? "Refund" : "Receipt"}</h3>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                        <CustomerPicker
                            tenant={tenant}
                            value={customer}
                            onChange={chooseCustomer}
                            disabled={readOnly}
                            error={errors?.customerId?.[0]}
                            className="lg:col-span-2"
                        />
                        <Field label="Date" name="postDate" errors={errors}>
                            <input
                                id="postDate" name="postDate" type="date" value={postDate} disabled={readOnly}
                                onChange={(e) => touch(setPostDate)(e.target.value)}
                                className="flex h-8 w-full rounded-md border border-input bg-white px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50"
                            />
                        </Field>
                        <TextField label="Note" name="note" errors={errors} value={note} disabled={readOnly} onChange={(e) => touch(setNote)(e.target.value)} />
                    </div>
                </section>

                <section className="border border-slate-200 rounded-sm bg-white">
                    <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{isRefund ? "How it is going out" : "How it was paid"}</h3>
                        {!readOnly && (
                            <Button
                                type="button" size="sm" variant="outline" className="h-7"
                                onClick={() => {
                                    setTenders((rows) => [...rows, { key: nextKey(), methodId: methods[0]?.id ?? "", amount: 0, received: null, reference: "", proof: null }]);
                                    setDirty(true);
                                }}
                            >
                                <Plus className="w-3.5 h-3.5 mr-1" />Add tender
                            </Button>
                        )}
                    </div>
                    <div className="divide-y divide-slate-100">
                        {tenders.length === 0 && (
                            <p className="px-4 py-4 text-sm text-slate-500">
                                {isRefund
                                    ? "Nothing going out yet. Add how the money is being paid back."
                                    : "No money tendered. Applying a credit note on its own is fine — add a tender if cash actually changed hands."}
                            </p>
                        )}
                        {tenders.map((t) => {
                            const method = methods.find((m) => m.id === t.methodId);
                            // Change is a cash idea, so the Received field only appears on the seeded CASH method.
                            const takesChange = !isRefund && method?.code === "CASH";
                            const given = round2(Math.max((t.received ?? 0) - Math.abs(Number(t.amount) || 0), 0));
                            // Only a bank transfer has a slip worth keeping.
                            const wantsProof = method?.isEft;
                            return (
                            <div key={t.key} className="px-4 py-2">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                                    <select
                                        aria-label="Payment method" value={t.methodId} disabled={readOnly}
                                        onChange={(e) => setTender(t.key, { methodId: e.target.value, received: null })}
                                        className="sm:col-span-3 h-8 rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50"
                                    >
                                        {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    {takesChange ? (
                                        <div className="sm:col-span-6 flex items-center gap-2">
                                            <input
                                                aria-label="Cash received" type="number" step="0.01" inputMode="decimal" disabled={readOnly}
                                                value={t.received ?? ""} placeholder="Cash received"
                                                onChange={(e) => setTender(t.key, { received: e.target.value === "" ? null : Number(e.target.value) })}
                                                className="h-8 w-40 rounded-md border border-input bg-white px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50"
                                            />
                                            <span className={`text-xs ${given > 0 ? "text-slate-700" : "text-slate-400"}`}>
                                                {given > 0 ? <>Change <strong className="tabular-nums">{money(given)}</strong></> : "Change 0.00"}
                                            </span>
                                        </div>
                                    ) : (
                                        <input
                                            aria-label="Reference" value={t.reference} disabled={readOnly}
                                            placeholder={method?.isEft ? "EFT reference — put it on the deposit slip" : "Reference (optional)"}
                                            onChange={(e) => setTender(t.key, { reference: e.target.value })}
                                            className="sm:col-span-6 h-8 rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50"
                                        />
                                    )}
                                    <input
                                        aria-label={isRefund ? "Amount paid out" : "Amount kept"} type="number" step="0.01" inputMode="decimal" disabled={readOnly}
                                        value={t.amount === 0 ? "" : t.amount} placeholder="0.00"
                                        onChange={(e) => setTender(t.key, { amount: Math.abs(Number(e.target.value)) })}
                                        className="sm:col-span-2 h-8 rounded-md border border-input bg-white px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50"
                                    />
                                    {!readOnly && (
                                        <button
                                            type="button" aria-label="Remove tender" className="sm:col-span-1 justify-self-end text-slate-400 hover:text-red-600"
                                            onClick={() => { setTenders((rows) => rows.filter((r) => r.key !== t.key)); setDirty(true); }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {wantsProof && (
                                    <div className="mt-1 sm:pl-[25%]">
                                        <TenderProof
                                            tenant={tenant}
                                            tenderId={t.id}
                                            proof={t.proof}
                                            disabled={readOnly}
                                            onChange={(proof) => setTenders((rows) => rows.map((r) => (r.key === t.key ? { ...r, proof } : r)))}
                                        />
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                </section>

                <AllocationGrid
                    items={items}
                    allocations={allocations}
                    onChange={touch(setAllocations)}
                    tendered={tendered}
                    direction={payment.direction}
                    readOnly={readOnly}
                    loading={loadingItems}
                />

                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="text-sm">
                        {state.message && <p className={state.ok ? "text-teal-700" : "text-red-600"} role={state.ok ? undefined : "alert"}>{state.message}</p>}
                        {!readOnly && problem && <p className="text-amber-700">{problem}</p>}
                        {!readOnly && !problem && dirty && <p className="text-slate-500">Save before posting.</p>}
                    </div>
                    <div className="flex items-end gap-6">
                        <dl className="text-sm text-right">
                            <div className="flex justify-between gap-8">
                                <dt className="text-slate-500">{isRefund ? "Paying out" : "Tendered"}</dt>
                                <dd className="tabular-nums font-medium">{money(Math.abs(tendered))}</dd>
                            </div>
                            {change > 0 && (
                                <div className="flex justify-between gap-8"><dt className="text-slate-500">Change given</dt><dd className="tabular-nums text-slate-600">{money(change)}</dd></div>
                            )}
                            <div className="flex justify-between gap-8">
                                <dt className="text-slate-500">{isRefund ? "Against credit notes" : "Applied"}</dt>
                                <dd className="tabular-nums font-medium">{money(Math.abs(allocated))}</dd>
                            </div>
                            <div className="flex justify-between gap-8 border-t mt-1 pt-1">
                                <dt className="text-slate-500">{isRefund ? "From credit on account" : "Unapplied credit"}</dt>
                                <dd className={`tabular-nums font-semibold ${Math.abs(unallocated) > 0 ? "text-amber-700" : "text-slate-700"}`}>{money(Math.abs(unallocated))}</dd>
                            </div>
                        </dl>
                        {!readOnly && (
                            <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
                                <Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}

/**
 * A receipt opened from an invoice arrives with the allocation already made,
 * so the obvious first tender is exactly that amount — which is what the
 * counter is about to be handed.
 */
function initialTenders(payment: PaymentRecord, methods: PaymentMethodOption[]): Tender[] {
    if (payment.tenders.length) {
        return payment.tenders.map((t) => ({
            key: nextKey(), id: t.id, methodId: t.methodId,
            amount: Math.abs(t.amount),
            received: t.tendered == null ? null : Math.abs(t.tendered),
            reference: t.reference ?? "",
            proof: t.proof ? { id: t.proof.id, fileName: t.proof.fileName } : null,
        }));
    }
    if (payment.state !== "DRAFT" || !methods.length) return [];
    const suggested = Math.abs(round2(payment.allocations.reduce((sum, a) => sum + a.amount, 0)));
    return [{ key: nextKey(), methodId: methods[0].id, amount: suggested, received: null, reference: "", proof: null }];
}
