"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startStockTakeAction } from "@/lib/stock/stocktake-actions";

const field = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";

/** Count a shelf, a range of codes, or a group — the whole lot is rarely what anyone wants. */
export function StartStockTake({ tenant, groups }: { tenant: string; groups: { id: string; name: string }[] }) {
    const [location, setLocation] = useState("");
    const [codeFrom, setCodeFrom] = useState("");
    const [codeTo, setCodeTo] = useState("");
    const [groupId, setGroupId] = useState("");
    const [includeZero, setIncludeZero] = useState(false);
    const [blind, setBlind] = useState(true);
    const [note, setNote] = useState("");
    const [error, setError] = useState<string>();
    const [busy, start] = useTransition();

    return (
        <section className="rounded-sm border border-slate-200 bg-white">
            <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Start a count</h2>
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-1 text-sm"><span className="text-slate-600">Shelf or location</span><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Any" className={`${field} w-full`} /></label>
                <label className="space-y-1 text-sm"><span className="text-slate-600">Group</span>
                    <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${field} w-full`}>
                        <option value="">Any group</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </label>
                <label className="space-y-1 text-sm"><span className="text-slate-600">Codes from</span><input value={codeFrom} onChange={(e) => setCodeFrom(e.target.value)} placeholder="e.g. BRK" className={`${field} w-full`} /></label>
                <label className="space-y-1 text-sm"><span className="text-slate-600">to</span><input value={codeTo} onChange={(e) => setCodeTo(e.target.value)} placeholder="e.g. OIL" className={`${field} w-full`} /></label>
                <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-4"><span className="text-slate-600">Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Month-end count, front store" className={`${field} w-full`} /></label>
            </div>
            <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                <label className="flex items-center gap-2"><input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} className="accent-teal-600" />Blind count — hide what the system expects</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} className="accent-teal-600" />Include items the books say are at zero</label>
                <Button type="button" className="ml-auto bg-teal-600 hover:bg-teal-700" disabled={busy}
                    onClick={() => start(async () => {
                        setError(undefined);
                        const result = await startStockTakeAction(tenant, { location, codeFrom, codeTo, groupId, includeZero }, blind, note);
                        if (result && !result.ok) setError(result.message);
                    })}>
                    {busy ? "Drawing up the sheet…" : "Start counting"}
                </Button>
            </div>
            {error && <p className="px-4 pb-3 text-sm text-red-600" role="alert">{error}</p>}
        </section>
    );
}
