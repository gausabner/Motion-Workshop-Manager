"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerAction } from "@/lib/auth/actions";
import { slugify } from "@/lib/slug";
import { COUNTRY_DEFAULTS } from "@/lib/tenant/country";
import { initialActionState } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLANS, CURRENCY, VAT_RATE, withVat } from "@/lib/pricing/plans";
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

export function RegisterForm() {
    const [state, action, pending] = useActionState(registerAction, initialActionState);
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [country, setCountry] = useState("NA");
    const local = COUNTRY_DEFAULTS[country];
    return (
        <form action={action} className="space-y-4">
            {/* The tier, in the form rather than on a screen afterwards.
                A workshop used to be created first and asked to choose later,
                and a real registration walked into the gap: a workshop with no
                plan, no amount and no reference — nothing anybody could act
                on. Chosen here, it is written in the same transaction as the
                workshop, so that state cannot exist. */}
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-900">Plan</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                    {PLANS.filter((p): p is typeof p & { price: number } => p.price !== null).map((plan) => (
                        <label
                            key={plan.id}
                            className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-teal-600 has-[:checked]:bg-teal-50/40"
                        >
                            <input type="radio" name="planId" value={plan.id} required className="mt-1 accent-teal-600" />
                            <span className="min-w-0">
                                <span className="block text-sm font-medium text-slate-900">{plan.name}</span>
                                <span className="block text-[13px] tabular-nums text-slate-900">
                                    {CURRENCY}{plan.price.toLocaleString("en-GB")}{" "}
                                    <span className="text-slate-500">per month, excluding VAT</span>
                                </span>
                                {/* The figure that leaves the bank, derived
                                    rather than typed beside it. */}
                                <span className="block text-[12px] text-slate-500">
                                    {CURRENCY}{withVat(plan.price).toLocaleString("en-GB", { maximumFractionDigits: 2 })} including VAT at {VAT_RATE}%
                                </span>
                                <span className="mt-1 block text-[12px] text-slate-500">{plan.who}</span>
                            </span>
                        </label>
                    ))}
                </div>
                {state.errors?.planId && <p className="text-xs text-red-600">{state.errors.planId[0]}</p>}
                <p className="text-[12px] text-slate-500">
                    More than one workshop, or buying for a municipality? That is quoted per site —{""}
                    <Link href="/support" className="font-medium text-teal-700 hover:underline">talk to us</Link>.
                </p>
            </fieldset>

            <Field label="Workshop name" name="workshopName" error={state.errors?.workshopName}>
                <Input id="workshopName" name="workshopName" required autoFocus onChange={(e) => { if (!slugTouched) setSlug(slugify(e.target.value)); }} />
            </Field>
            <Field label="Workshop address" name="slug" error={state.errors?.slug}>
                <div className="flex items-center gap-1 text-sm">
                    <span className="text-slate-400 whitespace-nowrap">motion.app/</span>
                    <Input id="slug" name="slug" value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} required />
                </div>
            </Field>
            <Field label="Country" name="country" error={state.errors?.country}>
                <select id="country" name="country" value={country} onChange={(e) => setCountry(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                    {Object.entries(COUNTRY_DEFAULTS).map(([code, c]) => <option key={code} value={code}>{c.name}</option>)}
                </select>
                <p className="text-xs text-slate-400">Sets {local.currency}, {local.taxName} at {local.taxRate}% and {local.timezone.split("/")[1]} time. You can change any of it later.</p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="First name" name="firstName" error={state.errors?.firstName}><Input id="firstName" name="firstName" required autoComplete="given-name" /></Field>
                <Field label="Last name" name="lastName" error={state.errors?.lastName}><Input id="lastName" name="lastName" required autoComplete="family-name" /></Field>
            </div>
            <Field label="Email" name="email" error={state.errors?.email}><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
            <Field label="Mobile (WhatsApp)" name="mobile" error={state.errors?.mobile}><Input id="mobile" name="mobile" type="tel" placeholder={`${local.dialPrefix} …`} autoComplete="tel" /></Field>
            <Field label="Password" name="password" error={state.errors?.password}><Input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} /></Field>
            {state.message && !state.ok && <p className="text-sm text-red-600" role="alert">{state.message}</p>}
            <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700" disabled={pending}>
                {pending ? "Creating workshop…" : "Create workshop"}
            </Button>
            <p className="text-center text-sm text-slate-500">
                Already have an account? <Link href="/login" className="text-teal-700 font-medium hover:underline">Sign in</Link>
            </p>
        </form>
    );
}
