"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { saveAppointmentType } from "@/lib/bookings/actions";

type Type = { id: string; description: string; estimatedHours: number; active: boolean };

/**
 * The services a workshop books — one list for the counter and the public
 * page, so "Major service" means the same three hours to both.
 */
export function AppointmentTypes({ tenant, types }: { tenant: string; types: Type[] }) {
    const [adding, setAdding] = useState(false);
    return (
        <section className="border border-slate-200 rounded-sm bg-white max-w-4xl">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Services</h3>
                {!adding && <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>}
            </div>
            <div className="grid grid-cols-12 gap-2 px-4 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <span className="col-span-6">Service</span><span className="col-span-2">Hours</span><span className="col-span-2">Bookable</span>
            </div>
            <ul className="divide-y divide-slate-100">
                {types.map((t) => <Row key={t.id} tenant={tenant} type={t} />)}
                {adding && <Row tenant={tenant} type={null} onDone={() => setAdding(false)} />}
            </ul>
            <p className="px-4 py-2 border-t text-[11px] text-slate-400">The hours are how long the diary blocks out, and what the public page books against. Untick to stop offering a service online.</p>
        </section>
    );
}

function Row({ tenant, type, onDone }: { tenant: string; type: Type | null; onDone?: () => void }) {
    const [state, action, saving] = useActionState(async (prev: typeof initialActionState, formData: FormData) => {
        const result = await saveAppointmentType(tenant, type?.id ?? null, prev, formData);
        if (result.ok && !type) onDone?.();
        return result;
    }, initialActionState);
    const e = state.errors;
    return (
        <li>
            <form action={action} className="grid grid-cols-12 items-center gap-2 px-4 py-2">
                <input name="description" defaultValue={type?.description} placeholder="e.g. Minor service" required className="col-span-6 h-8 rounded-md border border-slate-300 px-2 text-sm" aria-label="Service" />
                <input name="estimatedHours" type="number" step="0.25" min="0.25" defaultValue={type?.estimatedHours ?? 1} className="col-span-2 h-8 rounded-md border border-slate-300 px-2 text-sm tabular-nums" aria-label="Hours" />
                <label className="col-span-2 flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={type?.active ?? true} className="accent-teal-600" />Online</label>
                <div className="col-span-2 flex justify-end">
                    <Button type="submit" size="sm" variant="outline" className="h-7" disabled={saving}>{saving ? "…" : type ? "Save" : "Add"}</Button>
                </div>
                {(e?.description || e?.estimatedHours || (state.message && !state.ok)) && (
                    <p className="col-span-12 text-xs text-red-600">{e?.description?.[0] ?? e?.estimatedHours?.[0] ?? state.message}</p>
                )}
                {state.ok && state.message && <p className="col-span-12 text-xs text-teal-700">{state.message}</p>}
            </form>
        </li>
    );
}
