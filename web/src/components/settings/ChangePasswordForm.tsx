"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { changePasswordAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { MotionLogo } from "@/components/brand/MotionLogo";

const field =
    "w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-base shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-teal-500";

export function ChangePasswordForm({ tenant, forced, name }: { tenant: string; forced: boolean; name: string }) {
    const [state, action, pending] = useActionState(changePasswordAction.bind(null, tenant), { ok: true } as { ok: boolean; message?: string });

    return (
        <form action={action} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm">
            <MotionLogo className="h-[22px] w-auto" />

            <div>
                <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <KeyRound className="h-4 w-4 text-teal-600" aria-hidden="true" />
                    Choose your own password
                </h1>
                {forced ? (
                    <p className="mt-1 text-sm text-slate-600">
                        {name}, your password was set for you. Pick one only you know before you carry on — until
                        you do, whoever set it can sign in as you.
                    </p>
                ) : (
                    <p className="mt-1 text-sm text-slate-600">Change the password you use to sign in.</p>
                )}
            </div>

            <label className="block space-y-1 text-xs font-medium text-slate-600">
                <span>{forced ? "The password you were given" : "Current password"}</span>
                <input name="current" type="password" autoComplete="current-password" required className={field} />
            </label>

            <label className="block space-y-1 text-xs font-medium text-slate-600">
                <span>New password</span>
                <input name="password" type="password" autoComplete="new-password" minLength={8} required className={field} />
                <span className="block text-[11px] font-normal text-slate-500">At least 8 characters.</span>
            </label>

            <label className="block space-y-1 text-xs font-medium text-slate-600">
                <span>New password again</span>
                <input name="confirm" type="password" autoComplete="new-password" required className={field} />
            </label>

            {state.message && !state.ok && (
                <p className="text-sm text-red-600" role="alert">{state.message}</p>
            )}

            <Button type="submit" disabled={pending} className="h-11 w-full bg-teal-600 hover:bg-teal-700">
                {pending ? "Saving…" : "Save and sign in again"}
            </Button>

            <p className="text-[11px] text-slate-500">
                You will be signed out everywhere else, so anyone still signed in as you is signed out too.
            </p>
        </form>
    );
}
