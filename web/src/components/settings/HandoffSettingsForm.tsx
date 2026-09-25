"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { saveHandoffSettings } from "@/lib/settings/actions";
import type { AccountingSettings, HandoffSettings } from "@/lib/settings/schema";

const SHAPES: { value: HandoffSettings["shape"]; label: string; hint: string }[] = [
    { value: "motion", label: "Plain", hint: "One line per side of every entry. Start here if the other end is a person." },
    { value: "quickbooks", label: "QuickBooks", hint: "QuickBooks' general journal columns." },
    { value: "sage", label: "Sage Evolution", hint: "Sage's GL journal columns. Check them against the site's own import definition first." },
    { value: "xero", label: "Xero", hint: "Xero's manual journal columns, with one signed amount." },
];

const ACCOUNTS: { key: keyof AccountingSettings; label: string; hint: string }[] = [
    { key: "debtors", label: "Debtors", hint: "What customers owe. Goes up when you invoice, down when they pay." },
    { key: "sales", label: "Sales", hint: "The revenue itself, excluding tax." },
    { key: "tax", label: "Output tax", hint: "Tax charged on sales." },
    { key: "bank", label: "Bank", hint: "Money in and out." },
    { key: "creditors", label: "Creditors", hint: "What the workshop owes suppliers." },
    { key: "purchases", label: "Purchases", hint: "Stock and expenses bought in, excluding tax." },
    { key: "inputTax", label: "Input tax", hint: "Tax charged by suppliers." },
];

export function HandoffSettingsForm({ tenant, handoff, accounting }: { tenant: string; handoff: HandoffSettings; accounting: AccountingSettings }) {
    const [state, action, saving] = useActionState(saveHandoffSettings.bind(null, tenant), initialActionState);
    const [folder, setFolder] = useState(handoff.folder);

    const field = "h-9 w-full rounded-md border border-slate-300 px-2 text-sm";

    return (
        <form action={action} className="max-w-3xl space-y-4">
            <label className="flex items-start gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3">
                <input type="checkbox" name="enabled" defaultChecked={handoff.enabled} className="mt-1 accent-teal-600" />
                <span>
                    <span className="block font-medium text-slate-800">Send a journal every night</span>
                    <span className="block text-sm text-slate-500">
                        Leave this off until the account codes below have been agreed with whoever keeps the books. A month of journals posted to the
                        wrong codes is a great deal harder to undo than a month of not sending anything.
                    </span>
                </span>
            </label>

            <fieldset className="rounded-sm border border-slate-200 bg-white">
                <legend className="sr-only">Shape</legend>
                <p className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What is on the other end</p>
                <ul className="divide-y divide-slate-100">
                    {SHAPES.map((s) => (
                        <li key={s.value}>
                            <label className="flex items-start gap-3 px-4 py-2.5">
                                <input type="radio" name="shape" value={s.value} defaultChecked={handoff.shape === s.value} className="mt-1 accent-teal-600" />
                                <span>
                                    <span className="block text-sm font-medium text-slate-800">{s.label}</span>
                                    <span className="block text-xs text-slate-500">{s.hint}</span>
                                </span>
                            </label>
                        </li>
                    ))}
                </ul>
            </fieldset>

            <fieldset className="space-y-3 rounded-sm border border-slate-200 bg-white px-4 py-3">
                <legend className="sr-only">Where it goes</legend>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Where it goes</p>
                <label className="block space-y-1">
                    <span className="block text-sm text-slate-700">Drop folder</span>
                    <input name="folder" value={folder} onChange={(e) => setFolder(e.target.value)} className={field} />
                    <span className="block text-xs text-slate-500">
                        <code className="rounded bg-slate-100 px-1">{"{tenant}"}</code>, <code className="rounded bg-slate-100 px-1">{"{yyyy}"}</code>,{" "}
                        <code className="rounded bg-slate-100 px-1">{"{mm}"}</code> and <code className="rounded bg-slate-100 px-1">{"{dd}"}</code> are filled in.
                        Keep <code className="rounded bg-slate-100 px-1">{"{tenant}"}</code> for a folder per workshop; take it out for one shared folder —
                        the workshop&rsquo;s name is in every file either way.
                    </span>
                </label>
                <label className="block space-y-1">
                    <span className="block text-sm text-slate-700">Receipt folder</span>
                    <input name="receiptFolder" defaultValue={handoff.receiptFolder} placeholder="handoff/{tenant}/receipts" className={field} />
                    <span className="block text-xs text-slate-500">
                        Where the accounting system says it took the file, by writing one named the same with <code className="rounded bg-slate-100 px-1">.ok</code> on
                        the end. Leave it blank if nobody has agreed to do that — MOTION will then say what it sent, but never that anything received it.
                    </span>
                </label>
                <label className="block max-w-xs space-y-1">
                    <span className="block text-sm text-slate-700">Keep our copies for</span>
                    <span className="flex items-center gap-2">
                        <input type="number" name="keepYears" min={1} max={15} defaultValue={handoff.keepYears} className={`${field} w-24`} />
                        <span className="text-sm text-slate-500">years</span>
                    </span>
                </label>
            </fieldset>

            <fieldset className="rounded-sm border border-slate-200 bg-white">
                <legend className="sr-only">Account codes</legend>
                <p className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Account codes</p>
                <p className="px-4 pt-2 text-xs text-slate-500">These come from the chart of accounts on the other end, not from MOTION. Ask the bookkeeper rather than guessing: a journal that balances can still be entirely in the wrong place.</p>
                <ul className="divide-y divide-slate-100">
                    {ACCOUNTS.map((a) => (
                        <li key={a.key} className="flex items-center gap-3 px-4 py-2">
                            <label className="flex-1 text-sm text-slate-700" htmlFor={`acc-${a.key}`}>
                                {a.label}
                                <span className="block text-xs text-slate-500">{a.hint}</span>
                            </label>
                            <input id={`acc-${a.key}`} name={a.key} defaultValue={String(accounting[a.key] ?? "")} className="h-9 w-28 rounded-md border border-slate-300 px-2 text-sm tabular-nums" />
                        </li>
                    ))}
                </ul>
            </fieldset>

            <input type="hidden" name="salesAccount" value={accounting.salesAccount} />
            <input type="hidden" name="salesTaxType" value={accounting.salesTaxType} />

            <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                {state.message && <span className={`text-sm ${state.ok ? "text-teal-700" : "text-red-700"}`}>{state.message}</span>}
            </div>
        </form>
    );
}
