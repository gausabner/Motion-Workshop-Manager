"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { PlanChangeState } from "@/lib/billing/plan-change-actions";

/**
 * The one button that commits the request. Disabled while it is on its way,
 * because a second press would meet the open-request rule and read as an
 * error for something that worked.
 */
export function RequestChangeForm({
    action,
    planId,
    label,
    backHref,
}: {
    action: (prev: PlanChangeState, formData: FormData) => Promise<PlanChangeState>;
    planId: string;
    label: string;
    backHref: string;
}) {
    const [state, formAction, pending] = useActionState(action, { ok: false });
    return (
        <form action={formAction} className="space-y-3">
            <input type="hidden" name="planId" value={planId} />
            {state.message && !state.ok && (
                <p role="alert" className="text-sm text-red-700">
                    {state.message}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex h-10 items-center rounded-sm bg-teal-700 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-teal-800 disabled:opacity-70"
                >
                    {pending ? "Sending request…" : label}
                </button>
                <Link href={backHref} className="inline-flex h-10 items-center px-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                    Choose another plan
                </Link>
            </div>
        </form>
    );
}
