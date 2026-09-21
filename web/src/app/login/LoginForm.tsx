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
        <form action={action} className="space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
                {state.errors?.email && <p className="text-xs text-red-600">{state.errors.email[0]}</p>}
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" autoComplete="current-password" required />
                {state.errors?.password && <p className="text-xs text-red-600">{state.errors.password[0]}</p>}
            </div>
            {state.message && !state.ok && <p className="text-sm text-red-600" role="alert">{state.message}</p>}
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-sm text-slate-500">
                New workshop? <Link href="/register" className="text-teal-700 font-medium hover:underline">Create your account</Link>
            </p>
        </form>
    );
}
