"use client";

import { useActionState } from "react";
import { joinAction } from "@/lib/team/public-actions";
import { initialActionState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Field({ label, name, error, children }: { label: string; name: string; error?: string[]; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={name}>{label}</Label>
            {children}
            {error && <p className="text-xs text-red-600">{error[0]}</p>}
        </div>
    );
}

export function JoinForm({ token, hasAccount }: { token: string; hasAccount: boolean }) {
    const [state, action, pending] = useActionState(joinAction.bind(null, token), initialActionState);
    return (
        <form action={action} className="space-y-4">
            {hasAccount ? (
                <p className="text-sm text-slate-600">You already have a MOTION sign-in with this email. Enter its password to add this workshop to it.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="First name" name="firstName" error={state.errors?.firstName}><Input id="firstName" name="firstName" required autoComplete="given-name" autoFocus /></Field>
                        <Field label="Last name" name="lastName" error={state.errors?.lastName}><Input id="lastName" name="lastName" required autoComplete="family-name" /></Field>
                    </div>
                    <Field label="Mobile (WhatsApp)" name="mobile" error={state.errors?.mobile}><Input id="mobile" name="mobile" type="tel" autoComplete="tel" /></Field>
                </>
            )}
            <Field label={hasAccount ? "Password" : "Choose a password"} name="password" error={state.errors?.password}>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete={hasAccount ? "current-password" : "new-password"} autoFocus={hasAccount} />
            </Field>
            {state.message && !state.ok && <p className="text-sm text-red-600" role="alert">{state.message}</p>}
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={pending}>
                {pending ? "Joining…" : "Join the workshop"}
            </Button>
        </form>
    );
}
