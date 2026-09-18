"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveWorkingDay } from "@/lib/diary/actions";
import { minuteLabel } from "@/lib/diary/time";
import { WEEKDAY_SHORT } from "@/components/diary/shared";

type Override = { membershipId: string; weekday: number; startMinute: number; endMinute: number };

type Props = {
    tenant: string;
    mechanics: { id: string; name: string }[];
    overrides: Override[];
    shop: { opensAt: number; closesAt: number; workingDays: number[] };
    canEdit: boolean;
};

/**
 * Who works when. Only the exceptions are stored: a mechanic who keeps the
 * shop's hours has no rows at all, and changing the shop's hours moves them
 * with it — the benchmark's "Hide Defaults", as the default.
 */
export function WorkingHoursGrid({ tenant, mechanics, overrides, shop, canEdit }: Props) {
    const router = useRouter();
    const [editing, setEditing] = useState<{ membershipId: string; weekday: number } | null>(null);
    const [mode, setMode] = useState<"shop" | "custom" | "off">("shop");
    const [startAt, setStartAt] = useState("07:30");
    const [endAt, setEndAt] = useState("17:00");
    const [error, setError] = useState<string>();
    const [pending, start] = useTransition();

    const find = (membershipId: string, weekday: number) => overrides.find((o) => o.membershipId === membershipId && o.weekday === weekday);

    function open(membershipId: string, weekday: number) {
        if (!canEdit) return;
        const o = find(membershipId, weekday);
        setEditing({ membershipId, weekday });
        setError(undefined);
        if (!o) {
            setMode("shop");
            setStartAt(minuteLabel(shop.opensAt));
            setEndAt(minuteLabel(shop.closesAt));
        } else if (o.endMinute <= o.startMinute) {
            setMode("off");
        } else {
            setMode("custom");
            setStartAt(minuteLabel(o.startMinute));
            setEndAt(minuteLabel(o.endMinute));
        }
    }

    function save() {
        if (!editing) return;
        start(async () => {
            const result = await saveWorkingDay(tenant, { ...editing, mode, start: startAt, end: endAt });
            if (!result.ok) return setError(result.message);
            setEditing(null);
            router.refresh();
        });
    }

    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Weekly hours</h3>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                    <thead>
                        <tr className="text-xs text-slate-500">
                            <th className="px-4 py-2 text-left font-semibold">Mechanic</th>
                            {[1, 2, 3, 4, 5, 6, 7].map((w) => <th key={w} className="px-2 py-2 text-left font-semibold">{WEEKDAY_SHORT[w]}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {mechanics.map((m) => (
                            <tr key={m.id} className="border-t border-slate-100">
                                <td className="px-4 py-2 font-medium text-slate-700 whitespace-nowrap">{m.name}</td>
                                {[1, 2, 3, 4, 5, 6, 7].map((w) => {
                                    const o = find(m.id, w);
                                    const isEditing = editing?.membershipId === m.id && editing.weekday === w;
                                    const label = o
                                        ? o.endMinute > o.startMinute ? `${minuteLabel(o.startMinute)}–${minuteLabel(o.endMinute)}` : "Off"
                                        : shop.workingDays.includes(w) ? `${minuteLabel(shop.opensAt)}–${minuteLabel(shop.closesAt)}` : "Closed";
                                    return (
                                        <td key={w} className="px-1 py-1 align-top">
                                            {isEditing ? (
                                                <div className="space-y-1 rounded border border-teal-500 bg-white p-2 shadow-sm">
                                                    {(["shop", "custom", "off"] as const).map((value) => (
                                                        <label key={value} className="flex items-center gap-1.5 text-xs">
                                                            <input type="radio" name={`mode-${m.id}-${w}`} checked={mode === value} onChange={() => setMode(value)} className="accent-teal-600" />
                                                            {value === "shop" ? "Shop hours" : value === "custom" ? "Own hours" : "Day off"}
                                                        </label>
                                                    ))}
                                                    {mode === "custom" && (
                                                        <div className="flex items-center gap-1">
                                                            <input type="time" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="h-7 w-[5.5rem] rounded border border-slate-300 px-1 text-xs" aria-label="Starts" />
                                                            <input type="time" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="h-7 w-[5.5rem] rounded border border-slate-300 px-1 text-xs" aria-label="Finishes" />
                                                        </div>
                                                    )}
                                                    {error && <p className="text-[11px] text-red-600">{error}</p>}
                                                    <div className="flex gap-1 pt-1">
                                                        <Button type="button" size="sm" className="h-6 px-2 text-xs bg-teal-600 hover:bg-teal-700" disabled={pending} onClick={save}>Save</Button>
                                                        <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditing(null)}>Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button" onClick={() => open(m.id, w)} disabled={!canEdit}
                                                    className={`w-full rounded px-2 py-1.5 text-left text-xs tabular-nums ${o ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-400"} ${canEdit ? "hover:bg-slate-100" : ""}`}
                                                    title={o ? "Their own hours" : "Follows the shop's hours"}
                                                >
                                                    {label}
                                                </button>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="px-4 py-2 border-t text-[11px] text-slate-400">Grey follows the shop&rsquo;s hours and moves when they change. Green is set for that person.</p>
        </section>
    );
}
