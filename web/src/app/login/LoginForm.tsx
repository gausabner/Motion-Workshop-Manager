"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next?: string }) {
    const [state, action, pending] = useActionState(loginAction, initialActionState);
    return (
        // h-11 on the fields and the button, overriding the shared h-9.
        //
        // The shared control is sized for the signed-in product, which is a
        // dense ledger read at a counter, and 36px is right there. This page
        // is not that: it is opened on a phone at the start of a shift, by
        // somebody with workshop hands, and 36px is below the 44px that is the
        // accepted minimum for a touch target. Overridden here rather than
        // globally, because widening every control in the application would
        // undo a density decision that was made deliberately.
        //
        // The font size needs no help: the shared input is `text-base md:text-sm`,
        // so a phone already gets 16px and iOS does not zoom the page on focus.
        <form action={action} className="space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required autoFocus className="h-11" />
                {state.errors?.email && <p className="text-xs text-red-600">{state.errors.email[0]}</p>}
            </div>
            <div className="space-y-1.5">
                {/* Beside the label, not under the button. Somebody who has
                    mistyped their password twice is looking at this field, not
                    at the bottom of the card — and until now there was nothing
                    here at all: a locked-out owner's only route back in was to
                    telephone somebody. */}
                <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor="password">Password</Label>
                    <Link
                        href="/forgot"
                        className="text-[13px] text-slate-500 underline-offset-4 hover:text-teal-700 hover:underline"
                    >
                        Forgot your password?
                    </Link>
                </div>
                <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
                {state.errors?.password && <p className="text-xs text-red-600">{state.errors.password[0]}</p>}
            </div>
            {state.message && !state.ok && <p className="text-sm text-red-600" role="alert">{state.message}</p>}
            <Button type="submit" className="h-11 w-full bg-teal-600 text-[15px] hover:bg-teal-700" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-slate-500">
                New workshop? <Link href="/register" className="text-teal-700 font-medium hover:underline">Create your account</Link>
            </p>
        </form>
    );
}
