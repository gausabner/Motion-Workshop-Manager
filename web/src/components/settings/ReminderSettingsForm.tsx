"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { saveReminderSettings } from "@/lib/reminders/actions";
import type { ReminderSettings } from "@/lib/settings/schema";

const ROWS: { key: keyof ReminderSettings; label: string; unit: string; max: number }[] = [
    { key: "service", label: "Service due", unit: "days before the next service date", max: 60 },
    { key: "licence", label: "Licence disc", unit: "days before the disc expires", max: 60 },
    { key: "roadworthy", label: "Roadworthy", unit: "days before it runs out", max: 60 },
    { key: "booking", label: "Booking", unit: "days before the booking", max: 7 },
    { key: "quote", label: "Quote follow-up", unit: "days after the quote was sent", max: 30 },
];

export function ReminderSettingsForm({ tenant, settings }: { tenant: string; settings: ReminderSettings }) {
    const [state, action, saving] = useActionState(saveReminderSettings.bind(null, tenant), initialActionState);
    return (
        <form action={action} className="border border-slate-200 rounded-sm bg-white">
            <ul className="divide-y divide-slate-100">
                {ROWS.map((row) => (
                    <li key={row.key} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                        <label className="flex w-40 items-center gap-2 font-medium text-slate-700">
                            <input type="checkbox" name={`${row.key}.enabled`} defaultChecked={settings[row.key].enabled} className="accent-teal-600" />
                            {row.label}
                        </label>
                        <input
                            type="number" name={`${row.key}.days`} min={0} max={row.max} defaultValue={settings[row.key].days}
                            className="h-8 w-16 rounded-md border border-slate-300 px-2 text-sm tabular-nums" aria-label={`${row.label}: ${row.unit}`}
                        />
                        <span className="text-slate-500">{row.unit}</span>
                    </li>
                ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t px-4 py-2">
                <p className="text-[11px] text-slate-400">Nothing is sent by itself: due reminders wait on the Reminders list, each ready to send in one tap. Overdue ones stay for 30 days.</p>
                <div className="flex items-center gap-2">
                    {state.message && <span className={`text-xs ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</span>}
                    <Button type="submit" size="sm" variant="outline" className="h-7" disabled={saving}>{saving ? "…" : "Save"}</Button>
                </div>
            </div>
        </form>
    );
}
