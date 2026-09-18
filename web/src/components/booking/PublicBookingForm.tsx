"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/forms";
import { requestBooking } from "@/lib/bookings/public-actions";

const input = "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500";

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
    return (
        <label htmlFor={name} className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">{label}</span>
            {children}
            {error && <span className="block text-sm text-red-600">{error}</span>}
        </label>
    );
}

/** The last step: who you are and what you drive. Big fields — this is filled in on a phone. */
export function PublicBookingForm({ slug, type, day, time }: { slug: string; type: string; day: string; time: string }) {
    const [state, formAction, pending] = useActionState(requestBooking.bind(null, slug), initialActionState);
    const e = (name: string) => state.errors?.[name]?.[0];

    return (
        <form action={formAction} className="space-y-4">
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="day" value={day} />
            <input type="hidden" name="time" value={time} />
            {/* Invisible to people; bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First name" name="firstName" error={e("firstName")}><input id="firstName" name="firstName" autoComplete="given-name" required className={input} /></Field>
                <Field label="Surname" name="lastName" error={e("lastName")}><input id="lastName" name="lastName" autoComplete="family-name" required className={input} /></Field>
            </div>
            <Field label="Mobile (WhatsApp)" name="mobile" error={e("mobile")}><input id="mobile" name="mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="081 234 5678" required className={input} /></Field>
            <Field label="Email (optional)" name="email" error={e("email")}><input id="email" name="email" type="email" autoComplete="email" className={input} /></Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Registration" name="plate"><input id="plate" name="plate" placeholder="N 12345 W" autoCapitalize="characters" className={input} /></Field>
                <Field label="Vehicle" name="vehicle"><input id="vehicle" name="vehicle" placeholder="Toyota Hilux 2018" className={input} /></Field>
            </div>
            <Field label="Anything we should know? (optional)" name="notes">
                <textarea id="notes" name="notes" rows={3} maxLength={500} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" />
            </Field>

            {state.message && !state.ok && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{state.message}</p>}

            <button type="submit" disabled={pending} className="h-12 w-full rounded-md bg-teal-600 text-base font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
                {pending ? "Sending…" : "Request this booking"}
            </button>
            <p className="text-center text-xs text-slate-500">The workshop confirms every booking. You will hear from them on WhatsApp.</p>
        </form>
    );
}
