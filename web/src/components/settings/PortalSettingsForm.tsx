"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { savePortalSettings } from "@/lib/settings/actions";
import type { PortalSection, PortalSettings } from "@/lib/settings/schema";

const SECTIONS: { key: PortalSection; label: string; hint: string }[] = [
    { key: "inspections", label: "Inspections to approve", hint: "Findings waiting for their go-ahead, with photos" },
    { key: "jobs", label: "Vehicles in the workshop", hint: "The live status of a job, e.g. \"Waiting for parts\"" },
    { key: "bookings", label: "Upcoming bookings", hint: "Day and time of their next visit" },
    { key: "vehicles", label: "Vehicles and due dates", hint: "Next service, licence disc and roadworthy, plus \"Book a service\" when online booking is on" },
    { key: "account", label: "Balance and statement", hint: "What they owe, and a statement PDF" },
    { key: "invoices", label: "Invoices", hint: "Processed invoices, cash sales and credit notes from the last two years, as PDFs" },
    { key: "quotes", label: "Quotes", hint: "Quotes you have sent them in the last 90 days" },
];

export function PortalSettingsForm({ tenant, settings }: { tenant: string; settings: PortalSettings }) {
    const [state, action, saving] = useActionState(savePortalSettings.bind(null, tenant), initialActionState);
    const [accent, setAccent] = useState(settings.accent);
    return (
        <form action={action} className="space-y-4 max-w-3xl">
            <label className="flex items-start gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3">
                <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="mt-1 accent-teal-600" />
                <span>
                    <span className="block font-medium text-slate-800">Customer portal is on</span>
                    <span className="block text-sm text-slate-500">Each customer gets their own private link, sent from their customer page. Turning this off stops every link already sent, straight away.</span>
                </span>
            </label>

            <fieldset className="rounded-sm border border-slate-200 bg-white">
                <legend className="sr-only">What customers see</legend>
                <p className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What customers see</p>
                <ul className="divide-y divide-slate-100">
                    {SECTIONS.map((s) => (
                        <li key={s.key}>
                            <label className="flex items-start gap-3 px-4 py-2.5">
                                <input type="checkbox" name={`section.${s.key}`} defaultChecked={settings.sections[s.key]} className="mt-1 accent-teal-600" />
                                <span>
                                    <span className="block text-sm font-medium text-slate-700">{s.label}</span>
                                    <span className="block text-xs text-slate-500">{s.hint}</span>
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
            </fieldset>

            <div className="grid gap-4 rounded-sm border border-slate-200 bg-white px-4 py-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                    <span className="block font-medium text-slate-700">Colour</span>
                    <span className="flex items-center gap-2">
                        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 rounded border border-slate-300" aria-label="Portal colour" />
                        <input name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-28 rounded-md border border-slate-300 px-2 font-mono text-sm" aria-label="Portal colour code" />
                    </span>
                    <span className="block text-xs text-slate-500">Buttons and highlights. Your logo from the company profile goes at the top.</span>
                    {state.errors?.accent && <span className="block text-xs text-red-600">{state.errors.accent[0]}</span>}
                </label>
                <label className="space-y-1 text-sm">
                    <span className="block font-medium text-slate-700">Links last</span>
                    <span className="flex items-center gap-2">
                        <input type="number" name="linkDays" min={7} max={365} defaultValue={settings.linkDays} className="h-9 w-20 rounded-md border border-slate-300 px-2 text-sm tabular-nums" />
                        <span className="text-slate-500">days</span>
                    </span>
                    <span className="block text-xs text-slate-500">Send a fresh link any time; you can withdraw one from the customer&rsquo;s page.</span>
                </label>
                <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="block font-medium text-slate-700">Welcome message <span className="font-normal text-slate-400">(optional)</span></span>
                    <textarea name="welcome" defaultValue={settings.welcome} maxLength={400} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Open Mon–Fri 07:30–17:00. Collections until 17:30." />
                </label>
            </div>

            <div className="flex items-center gap-3">
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                {state.message && <p className={`text-sm ${state.ok ? "text-teal-700" : "text-red-600"}`} role={state.ok ? undefined : "alert"}>{state.message}</p>}
            </div>
        </form>
    );
}
