"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { saveNumberingSettings } from "@/lib/settings/actions";
import type { NumberingRow } from "@/lib/settings/numbering";

/**
 * Each series on one line: what it is, its prefix, where it continues from,
 * and — as you type — exactly what the next document will be called.
 *
 * The preview is the point of the screen. A prefix and a number are abstract;
 * "your next invoice will be TT/INV/2401" is what somebody is actually
 * deciding, and seeing it before saving is cheaper than seeing it on an
 * invoice a customer already has.
 */
export function NumberingSettingsForm({ tenant, rows }: { tenant: string; rows: NumberingRow[] }) {
    const [state, formAction, saving] = useActionState(saveNumberingSettings.bind(null, tenant), initialActionState);
    const [values, setValues] = useState(() => Object.fromEntries(rows.map((r) => [r.key, { prefix: r.prefix, next: String(r.next) }])));
    const errors = state.errors ?? {};
    const set = (key: string, field: "prefix" | "next", value: string) => setValues((v) => ({ ...v, [key]: { ...v[key], [field]: value } }));

    return (
        <form action={formAction} className="max-w-4xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl space-y-2 text-sm text-slate-600">
                    <p>
                        Every kind of document has its own series: a prefix you choose and the number it continues from. Documents already
                        numbered keep their numbers.
                    </p>
                    <p>
                        A number is never issued twice, so a series can only continue above the highest number already issued with its
                        prefix. A new prefix can start anywhere. Coming from another system? Set the next number to carry on where your old
                        invoices stopped.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {state.message && (
                        <span className={state.ok ? "text-sm text-teal-700" : "text-sm text-red-600"} role={state.ok ? "status" : "alert"}>
                            {state.message}
                        </span>
                    )}
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
                        <Save className="mr-1 h-4 w-4" />
                        {saving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="hidden grid-cols-[minmax(0,1.6fr)_8rem_8rem_minmax(0,1fr)] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 md:grid">
                    <span>Document</span>
                    <span>Prefix</span>
                    <span>Next number</span>
                    <span>Next one will be</span>
                </div>
                <ul className="divide-y divide-slate-100">
                    {rows.map((row) => {
                        const v = values[row.key];
                        const prefixErr = errors[`prefix_${row.key}`]?.[0];
                        const nextErr = errors[`next_${row.key}`]?.[0];
                        const preview = /^\d+$/.test(v.next) ? `${v.prefix}${Number(v.next)}` : "—";
                        return (
                            <li key={row.key} className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_8rem_8rem_minmax(0,1fr)] md:items-start">
                                <div className="col-span-2 md:col-span-1">
                                    <p className="text-sm font-medium text-slate-900">{row.label}</p>
                                    <p className="text-xs text-slate-500">{row.hint}</p>
                                </div>
                                <label className="block space-y-1">
                                    <span className="text-xs text-slate-600 md:sr-only">Prefix</span>
                                    <input
                                        name={`prefix_${row.key}`}
                                        value={v.prefix}
                                        onChange={(e) => set(row.key, "prefix", e.target.value)}
                                        maxLength={12}
                                        autoComplete="off"
                                        spellCheck={false}
                                        aria-invalid={!!prefixErr}
                                        aria-label={`${row.label} prefix`}
                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 aria-[invalid=true]:border-red-500"
                                    />
                                    {prefixErr && <span className="block text-xs text-red-600">{prefixErr}</span>}
                                </label>
                                <label className="block space-y-1">
                                    <span className="text-xs text-slate-600 md:sr-only">Next number</span>
                                    <input
                                        name={`next_${row.key}`}
                                        value={v.next}
                                        onChange={(e) => set(row.key, "next", e.target.value)}
                                        inputMode="numeric"
                                        autoComplete="off"
                                        aria-invalid={!!nextErr}
                                        aria-label={`${row.label} next number`}
                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 font-mono text-sm tabular-nums text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 aria-[invalid=true]:border-red-500"
                                    />
                                    {nextErr && <span className="block text-xs text-red-600">{nextErr}</span>}
                                </label>
                                <div className="col-span-2 text-sm md:col-span-1 md:pt-2">
                                    <span className="font-mono font-semibold text-slate-900">{preview}</span>
                                    <span className="mt-0.5 block text-xs text-slate-500">
                                        {row.lastIssued ? `Last issued ${row.lastIssued}` : "None issued with this prefix yet"}
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </form>
    );
}
