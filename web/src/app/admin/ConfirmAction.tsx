"use client";

import { useActionState, useState } from "react";
import type { AdminActionState } from "@/app/admin/actions";

/**
 * A button that asks once before it acts.
 *
 * Every move on this screen changes whether a business can use the product it
 * pays for, so none of them happen on a single click. Not `window.confirm`: a
 * native dialog says "localhost says" above whatever it asks, cannot carry the
 * workshop's name in a way people read, and is the first thing a tired person
 * clicks through. The question appears in place, naming what is about to
 * happen and to whom, with the confirming button worded as the act itself.
 */
export function ConfirmAction({
    action,
    tenantId,
    label,
    question,
    confirmLabel,
    tone = "neutral",
    fields,
}: {
    action: (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;
    tenantId: string;
    label: string;
    question: string;
    confirmLabel: string;
    tone?: "primary" | "neutral" | "danger";
    /** Extra hidden values the action checks against — the date the screen showed, so a stale click is refused. */
    fields?: Record<string, string>;
}) {
    const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });
    const [asking, setAsking] = useState(false);

    // Close the question once the action has worked. Left open, the row
    // redraws with fresh values in the hidden fields — a renewal's new date —
    // so a second press on the same open question would record a second month
    // rather than be refused as stale. Done while rendering, which is React's
    // way of adjusting state to a new result without a flash of the old one.
    const [answered, setAnswered] = useState(state);
    if (state !== answered) {
        setAnswered(state);
        if (state.ok) setAsking(false);
    }

    const trigger = {
        primary: "border-teal-600 bg-teal-600 text-white hover:bg-teal-700",
        neutral: "border-slate-300 bg-white text-slate-900 hover:border-slate-400",
        danger: "border-slate-300 bg-white text-red-700 hover:border-red-300",
    }[tone];
    const confirm = tone === "danger" ? "border-red-600 bg-red-600 text-white hover:bg-red-700" : "border-teal-600 bg-teal-600 text-white hover:bg-teal-700";

    // A failure stays visible; a success needs no message, because the row
    // moving to its new section is the confirmation.
    const failure = state.message && !state.ok ? state.message : null;

    if (!asking) {
        return (
            <div className="flex flex-col items-end gap-1">
                <button
                    type="button"
                    onClick={() => setAsking(true)}
                    className={`inline-flex min-h-9 items-center rounded-md border px-3 text-[13px] font-medium ${trigger}`}
                >
                    {label}
                </button>
                {failure && <p role="alert" className="max-w-xs text-right text-[12px] text-red-600">{failure}</p>}
            </div>
        );
    }

    return (
        <form action={formAction} className="flex flex-col items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <input type="hidden" name="tenantId" value={tenantId} />
            {fields && Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
            <p className="max-w-xs text-right text-[13px] leading-snug text-slate-900">{question}</p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setAsking(false)}
                    disabled={pending}
                    className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-700"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={pending}
                    className={`inline-flex min-h-9 items-center rounded-md border px-3 text-[13px] font-medium disabled:opacity-70 ${confirm}`}
                >
                    {pending ? "Working…" : confirmLabel}
                </button>
            </div>
            {failure && <p role="alert" className="max-w-xs text-right text-[12px] text-red-600">{failure}</p>}
        </form>
    );
}
