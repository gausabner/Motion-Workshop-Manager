"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { loginAction } from "@/lib/auth/actions";
import { initialActionState } from "@/lib/forms";

/**
 * Signing in.
 *
 * The controls are sized for this page rather than taken from the shared ones.
 * The shared input is 36px, which is right for the signed-in product — a dense
 * ledger read at a counter — and wrong here: this is opened on a phone at the
 * start of a shift by somebody with workshop hands, and 36px is below the 44px
 * that is the accepted minimum for a touch target. 52px is what the design
 * asks for and what a thumb wants.
 *
 * Font size needs no help. These are `text-base`, so a phone gets 16px and iOS
 * does not zoom the page on focus — which it does, silently and infuriatingly,
 * at anything smaller.
 */

const FIELD =
    "w-full min-h-[52px] rounded-xl border border-slate-500 bg-white px-4 text-base text-slate-900 " +
    "placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-[3px] focus:ring-teal-600/20 " +
    "aria-[invalid=true]:border-amber-500";

export function LoginForm({ next }: { next?: string }) {
    const [state, action, pending] = useActionState(loginAction, initialActionState);
    const [shown, setShown] = useState(false);

    return (
        <form action={action} className="flex flex-col gap-5">
            {next && <input type="hidden" name="next" value={next} />}

            {/* The form-level failure gets a box rather than a line of red.
                "That email and password don't match" is the one message on this
                page somebody has to actually read before trying again, and a
                sentence the same size as the labels gets skipped — they retype
                the same password and fail twice. Field-level errors stay as
                small text, because the field they sit under already says where
                to look. */}
            {state.message && !state.ok && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl border-[1.5px] border-amber-500 bg-white px-4 py-4">
                    <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <p className="text-[15px] leading-relaxed text-slate-900">
                        {state.message}{" "}
                        <Link href="/forgot" className="font-medium text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-4 hover:text-teal-700">
                            Reset your password
                        </Link>
                        .
                    </p>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-[14px] font-semibold text-slate-900">
                    Email
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    autoFocus
                    aria-invalid={state.errors?.email ? true : undefined}
                    className={FIELD}
                />
                {state.errors?.email && <p className="text-[13px] text-red-600">{state.errors.email[0]}</p>}
            </div>

            <div className="flex flex-col gap-2">
                {/* Beside the label, not under the button. Somebody who has
                    mistyped their password twice is looking at this field, not
                    at the bottom of the card. */}
                <div className="flex items-baseline justify-between gap-4">
                    <label htmlFor="password" className="text-[14px] font-semibold text-slate-900">
                        Password
                    </label>
                    <Link
                        href="/forgot"
                        className="text-[14px] font-medium text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-4 hover:text-teal-700"
                    >
                        Forgot your password?
                    </Link>
                </div>
                <div className="relative">
                    <input
                        id="password"
                        name="password"
                        type={shown ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        aria-invalid={state.errors?.password ? true : undefined}
                        className={`${FIELD} pr-[4.75rem]`}
                    />
                    {/* Worth having on a phone, where a long password typed with
                        workshop hands is the difference between signing in and
                        resetting. `aria-pressed` rather than changing the label
                        alone, so a screen reader is told it is a toggle. */}
                    <button
                        type="button"
                        onClick={() => setShown((s) => !s)}
                        aria-controls="password"
                        aria-pressed={shown}
                        className="absolute right-1.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg px-3 text-[14px] font-semibold text-slate-900 hover:bg-slate-100"
                    >
                        {shown ? "Hide" : "Show"}
                    </button>
                </div>
                {state.errors?.password && <p className="text-[13px] text-red-600">{state.errors.password[0]}</p>}
            </div>

            <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-teal-600 bg-teal-600 text-base font-semibold text-white motion-safe:transition-transform motion-safe:duration-300 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-progress disabled:opacity-75"
            >
                {pending ? "Signing in…" : "Sign in"}
            </button>

            <p className="text-[15px] text-slate-500">
                New to MOTION?{" "}
                <Link href="/register" className="font-semibold text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-4 hover:text-teal-700">
                    Register your workshop
                </Link>
            </p>
        </form>
    );
}
