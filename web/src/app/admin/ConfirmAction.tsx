"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
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

    // Once the action has worked, the button is replaced by what happened —
    // and stays replaced until the page is loaded again.
    //
    // Both halves matter. Left open, the question redraws with fresh hidden
    // values (a renewal's new date), so a second press records a second month
    // instead of being refused as stale. And closed back to the button with
    // nothing said, a row that does not move — a paid-up workshop stays under
    // Active — looks exactly as it did before the click. That is how three
    // months were recorded for one workshop in under a minute: each press
    // looked like it had not worked. Done while rendering, React's way of
    // adjusting state to a new result without a flash of the old one.
    const [answered, setAnswered] = useState(state);
    const [done, setDone] = useState<string | null>(null);
    if (state !== answered) {
        setAnswered(state);
        if (state.ok) {
            setAsking(false);
            setDone(state.message || "Done.");
        }
    }

    const trigger = {
        primary: "border-teal-600 bg-teal-600 text-white hover:bg-teal-700",
        neutral: "border-slate-300 bg-white text-slate-900 hover:border-slate-400",
        danger: "border-slate-300 bg-white text-red-700 hover:border-red-300",
    }[tone];
    const confirm = tone === "danger" ? "border-red-600 bg-red-600 text-white hover:bg-red-700" : "border-teal-600 bg-teal-600 text-white hover:bg-teal-700";

    const failure = state.message && !state.ok ? state.message : null;

    if (done) {
        return (
            <p role="status" className="flex max-w-xs items-start justify-end gap-1.5 text-right text-[13px] font-medium leading-snug text-teal-800">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{done}</span>
            </p>
        );
    }

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
