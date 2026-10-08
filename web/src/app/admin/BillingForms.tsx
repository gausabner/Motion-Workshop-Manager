"use client";

import { useActionState, useState } from "react";
import type { AdminActionState } from "@/app/admin/actions";

/**
 * The two billing forms on /admin, each folded behind a button until needed.
 *
 * Folded because they are rare — setting up billing happens once per workshop
 * that predates plans, and correcting a date should be rarer still — and a row
 * of open date pickers on every workshop would make the common action, a
 * payment received, harder to find.
 */

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

const input =
    "h-9 rounded-md border border-slate-300 bg-white px-2.5 text-[13px] text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20";
const label = "flex flex-col gap-1 text-[12px] font-medium text-slate-600";

/** Closes the form when the action succeeds — the row redrawing with the new date is the confirmation. */
function useClosesOnSuccess(state: AdminActionState, setOpen: (v: boolean) => void) {
    const [seen, setSeen] = useState(state);
    if (state !== seen) {
        setSeen(state);
        if (state.ok) setOpen(false);
    }
}

function Folded({ open, label: buttonLabel, onOpen }: { open: boolean; label: string; onOpen: () => void }) {
    if (open) return null;
    return (
        <button
            type="button"
            onClick={onOpen}
            className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-900 hover:border-slate-400"
        >
            {buttonLabel}
        </button>
    );
}

function Footer({ pending, submit, onCancel, state }: { pending: boolean; submit: string; onCancel: () => void; state: AdminActionState }) {
    return (
        <>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-700"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-teal-600 bg-teal-600 px-3 text-[13px] font-medium text-white hover:bg-teal-700 disabled:opacity-70"
                >
                    {pending ? "Working…" : submit}
                </button>
            </div>
            {state.message && !state.ok && (
                <p role="alert" className="text-right text-[12px] text-red-600">
                    {state.message}
                </p>
            )}
        </>
    );
}

export function SetUpBilling({
    action,
    tenantId,
    plans,
    defaultPaidUntil,
}: {
    action: Action;
    tenantId: string;
    plans: { id: string; name: string; price: number | null }[];
    defaultPaidUntil: string;
}) {
    const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
    const [open, setOpen] = useState(false);
    const [planId, setPlanId] = useState(plans[0]?.id ?? "");
    const [amount, setAmount] = useState(String(plans[0]?.price ?? ""));
    useClosesOnSuccess(state, setOpen);

    if (!open) return <Folded open={open} label="Set up billing" onOpen={() => setOpen(true)} />;
    return (
        <form action={formAction} className="flex w-full max-w-sm flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <input type="hidden" name="tenantId" value={tenantId} />
            <p className="text-[13px] leading-snug text-slate-900">
                Put this workshop on a plan. No payment is recorded — give the date it is already paid up to, and renewals run from there.
            </p>
            <div className="grid grid-cols-2 gap-2">
                <label className={label}>
                    Plan
                    <select
                        name="planId"
                        value={planId}
                        onChange={(e) => {
                            setPlanId(e.target.value);
                            const price = plans.find((p) => p.id === e.target.value)?.price;
                            if (price) setAmount(String(price));
                        }}
                        className={input}
                    >
                        {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={label}>
                    Amount excl. VAT (N$)
                    <input name="amount" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} className={input} />
                </label>
                <label className={label}>
                    Renews
                    <select name="period" defaultValue="MONTHLY" className={input}>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="ANNUAL">Annually</option>
                    </select>
                </label>
                <label className={label}>
                    Paid up to
                    <input name="paidUntil" type="date" required defaultValue={defaultPaidUntil} className={input} />
                </label>
            </div>
            <Footer pending={pending} submit="Set up billing" onCancel={() => setOpen(false)} state={state} />
        </form>
    );
}

export function ChangePaidUntil({ action, tenantId, current }: { action: Action; tenantId: string; current: string }) {
    const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
    const [open, setOpen] = useState(false);
    useClosesOnSuccess(state, setOpen);

    if (!open) return <Folded open={open} label="Change date" onOpen={() => setOpen(true)} />;
    return (
        <form action={formAction} className="flex w-full max-w-xs flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <input type="hidden" name="tenantId" value={tenantId} />
            <p className="text-[13px] leading-snug text-slate-900">
                For corrections — a payment arranged another way, a month given free. To record money received, use Payment received instead.
            </p>
            <label className={label}>
                Paid up to
                <input name="paidUntil" type="date" required defaultValue={current} className={input} />
            </label>
            <Footer pending={pending} submit="Save date" onCancel={() => setOpen(false)} state={state} />
        </form>
    );
}

/**
 * Reversing a payment recorded in error. Folded, red, and asking for a reason
 * in words — the reason is printed on the credit note the owner receives, so
 * "mistake" is not enough and "Recorded three times by mistake" is.
 */
export function ReversePayment({
    action,
    tenantId,
    paymentId,
    invoiceNumber,
    restoresTo,
}: {
    action: Action;
    tenantId: string;
    paymentId: string;
    invoiceNumber: string | null;
    restoresTo: string;
}) {
    const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
    const [open, setOpen] = useState(false);
    const [seen, setSeen] = useState(state);
    const [done, setDone] = useState<string | null>(null);
    if (state !== seen) {
        setSeen(state);
        if (state.ok) {
            setOpen(false);
            setDone(state.message);
        }
    }

    if (done) return <p role="status" className="max-w-xs text-right text-[13px] font-medium leading-snug text-teal-800">{done}</p>;
    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] font-medium text-red-700 hover:border-red-300"
            >
                Reverse
            </button>
        );
    }
    return (
        <form action={formAction} className="flex w-full max-w-sm flex-col gap-3 rounded-md border border-red-200 bg-white p-3 text-left">
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="paymentId" value={paymentId} />
            <p className="text-[13px] leading-snug text-slate-900">
                For a payment recorded by mistake.{" "}
                {invoiceNumber ? `Tax invoice ${invoiceNumber} is cancelled by a credit note emailed to the owner, and the` : "The"}{" "}
                paid-up-to date goes back to {restoresTo}. The payment stays on the record, marked reversed.
            </p>
            <label className={label}>
                Reason, printed on the credit note
                <textarea
                    name="reason"
                    required
                    minLength={5}
                    maxLength={300}
                    rows={2}
                    placeholder="Recorded twice by mistake — only one payment was received."
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
            </label>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-700"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-red-600 bg-red-600 px-3 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-70"
                >
                    {pending ? "Working…" : invoiceNumber ? "Reverse and send credit note" : "Reverse"}
                </button>
            </div>
            {state.message && !state.ok && (
                <p role="alert" className="text-right text-[12px] text-red-600">
                    {state.message}
                </p>
            )}
        </form>
    );
}
