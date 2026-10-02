"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { choosePlanAction, type ChoosePlanState } from "@/app/activate/actions";

export type ChoosablePlan = {
    id: string;
    name: string;
    who: string;
    /** Excluding VAT, already formatted — the server owns money formatting. */
    exclusive: string;
    inclusive: string;
    includes: string[];
};

/**
 * Picking a tier, by somebody who has just registered and cannot do anything
 * else yet.
 *
 * Not the pricing page. That page sells; this one is a decision being made by
 * somebody who has already decided to buy, so the feature lists are trimmed to
 * what separates the tiers and the "council" tier is absent entirely — it is
 * priced per site by a person, and offering it here would issue a reference for
 * an amount nobody has agreed.
 *
 * Both figures are shown on every card. A customer who picks a tier at N$1,200
 * and is later asked for N$1,380 has been surprised at the bank, which is a
 * complaint rather than a surprise.
 */
export function PlanChooser({ plans, vatRate }: { plans: ChoosablePlan[]; vatRate: number }) {
    const [state, action, pending] = useActionState<ChoosePlanState, FormData>(choosePlanAction, { ok: false });

    return (
        <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Choose a plan</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                Your workshop is created. Pick the tier that fits and we will give you a payment reference — you are in as soon as
                the payment clears with us.
            </p>

            {/* The same shape the sign-in and register forms use for a failed
                submission — plain red text, no tinted box. Worth matching
                rather than inventing: a third alert style is how an app starts
                looking assembled from parts. */}
            {state.message && (
                <p role="alert" className="mt-4 text-sm text-red-600">
                    {state.message}
                </p>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {plans.map((plan) => (
                    <form key={plan.id} action={action} className="flex">
                        <input type="hidden" name="planId" value={plan.id} />
                        <div className="flex flex-1 flex-col rounded-xl border border-slate-200 p-5">
                            <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">{plan.name}</h2>
                            <p className="mt-1 text-[12.5px] text-slate-500">{plan.who}</p>

                            <p className="mt-4 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-slate-900">
                                {plan.exclusive}
                            </p>
                            <p className="mt-1 text-[12px] text-slate-500">per month, excluding VAT</p>
                            <p className="text-[12px] text-slate-500">
                                {plan.inclusive} including VAT at {vatRate}%
                            </p>

                            <ul className="mt-4 flex-1 space-y-1.5">
                                {plan.includes.map((line) => (
                                    <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-slate-700">
                                        <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" strokeWidth={2.5} />
                                        {line}
                                    </li>
                                ))}
                            </ul>

                            <Button type="submit" disabled={pending} className="mt-5 h-11 w-full">
                                {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
                                Choose {plan.name}
                            </Button>
                        </div>
                    </form>
                ))}
            </div>

            <p className="mt-6 text-[13px] leading-relaxed text-slate-500">
                Running more than one workshop, or buying for a municipality? That is quoted per site —{" "}
                <Link href="/support" className="font-medium text-teal-700 hover:underline">
                    talk to us
                </Link>{" "}
                and we will send you a figure.
            </p>
        </div>
    );
}
