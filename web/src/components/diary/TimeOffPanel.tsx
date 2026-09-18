"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SelectField, TextField } from "@/components/forms/fields";
import { initialActionState } from "@/lib/forms";
import { addTimeOff, removeTimeOff } from "@/lib/diary/actions";

type Entry = { id: string; name: string; from: string; to: string; reason: string | null };

/** Leave and appointments — shaded on the diary and taken out of capacity. */
export function TimeOffPanel({ tenant, mechanics, entries, canEdit }: { tenant: string; mechanics: { id: string; name: string }[]; entries: Entry[]; canEdit: boolean }) {
    const [state, formAction, saving] = useActionState(addTimeOff.bind(null, tenant), initialActionState);
    const [removing, start] = useTransition();
    const errors = state.errors;

    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Leave and time away</h3>
            {canEdit && (
                <form action={formAction} className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 md:grid-cols-5 md:items-end">
                    <SelectField label="Who" name="membershipId" errors={errors} allowEmpty="Choose…" options={mechanics.map((m) => ({ value: m.id, label: m.name }))} />
                    <TextField label="From" name="startsAt" type="datetime-local" errors={errors} />
                    <TextField label="Until" name="endsAt" type="datetime-local" errors={errors} />
                    <TextField label="Reason" name="reason" errors={errors} placeholder="Annual leave, course…" />
                    <Field label=" " name="submit">
                        <Button type="submit" size="sm" className="h-8 w-full bg-teal-600 hover:bg-teal-700" disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
                    </Field>
                    {state.message && <p className={`md:col-span-5 text-xs ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</p>}
                </form>
            )}
            {entries.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">Nobody has time away coming up.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {entries.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                            <span><strong className="font-medium text-slate-700">{e.name}</strong> <span className="text-slate-500">{e.from} → {e.to}</span>{e.reason && <span className="text-slate-400"> · {e.reason}</span>}</span>
                            {canEdit && (
                                <button type="button" disabled={removing} onClick={() => start(() => removeTimeOff(tenant, e.id))} className="text-slate-400 hover:text-red-600" aria-label="Remove">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
