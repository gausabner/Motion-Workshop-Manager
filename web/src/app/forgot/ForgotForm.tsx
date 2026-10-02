"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResetProgress } from "@/components/auth/ResetProgress";
import { requestResetAction, type ForgotState } from "@/app/forgot/actions";

export function ForgotForm() {
    const [state, action, pending] = useActionState<ForgotState, FormData>(requestResetAction, { sent: false, email: "" });

    if (state.sent) {
        return (
            <>
                <ResetProgress current="sent" />
                <div className="mt-7 text-center">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-teal-50 text-teal-700">
                        <MailCheck className="h-5 w-5" aria-hidden />
                    </span>
                    <h1 className="mt-4 text-[20px] font-semibold tracking-tight text-slate-900">Check your inbox</h1>
                    {/* Deliberately "if that address is on an account". Saying
                        "we have sent you an email" would confirm the address
                        exists, which is the one thing this form must not do. */}
                    <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                        If <span className="font-medium text-slate-900">{state.email}</span> is on a MOTION account, a link to set a new
                        password is on its way. It works once and expires in an hour.
                    </p>
                    <p className="mt-4 text-[13px] leading-relaxed text-slate-500">
                        Nothing after a few minutes? Check spam, then ask whoever set up your workshop — an owner can hand you a link
                        directly.
                    </p>
                    <Link
                        href="/login"
                        className="mt-6 inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-teal-700 hover:underline"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                        Back to sign in
                    </Link>
                </div>
            </>
        );
    }

    return (
        <>
            <ResetProgress current="ask" />
            <h1 className="mt-7 text-[22px] font-semibold tracking-tight text-slate-900">Forgot your password</h1>
            <p className="mb-6 mt-1 text-[14px] text-slate-500">
                Your email address, and we will send a link to set a new one.
            </p>
            <form action={action} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" autoComplete="email" required autoFocus className="h-11" />
                </div>
                <Button type="submit" className="h-11 w-full bg-teal-600 text-[15px] hover:bg-teal-700" disabled={pending}>
                    {pending ? "Sending…" : "Send the link"}
                </Button>
            </form>
            <p className="mt-5 text-center text-[13px] text-slate-500">
                Remembered it?{" "}
                <Link href="/login" className="font-medium text-teal-700 hover:underline">
                    Sign in
                </Link>
            </p>
        </>
    );
}
