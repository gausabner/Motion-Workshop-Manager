"use client";

import { useActionState } from "react";
import { setPasswordFromResetAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const field =
    "w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-base shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-teal-500";

export function SetPasswordForm({ token, slug }: { token: string; slug: string }) {
    const [state, action, pending] = useActionState(
        setPasswordFromResetAction.bind(null, slug, token),
        { ok: true } as { ok: boolean; message?: string },
    );

    return (
        <form action={action} className="space-y-4">
            <label className="block space-y-1 text-xs font-medium text-slate-600">
                <span>New password</span>
                <input name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus className={field} />
                <span className="block text-[11px] font-normal text-slate-500">At least 8 characters.</span>
            </label>
            <label className="block space-y-1 text-xs font-medium text-slate-600">
                <span>New password again</span>
                <input name="confirm" type="password" autoComplete="new-password" required className={field} />
            </label>
            {state.message && !state.ok && <p className="text-sm text-red-600" role="alert">{state.message}</p>}
            <Button type="submit" disabled={pending} className="h-11 w-full bg-teal-600 hover:bg-teal-700">
                {pending ? "Saving…" : "Set password and sign in"}
            </Button>
            <p className="text-[11px] text-slate-500">
                Anyone currently signed in as you will be signed out.
            </p>
        </form>
    );
}
