"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appointAction, archiveWorkshopAction, revokeAction, saveWorkshopAction } from "@/lib/requisitions/settings-actions";
import { AppointedChip, ArchiveButton, Outcome, Panel, PersonSelect, field, useAction, type Appointment, type Person } from "@/components/settings/council/shared";

export type WorkshopRow = { id: string; name: string; kind: "RECEPTION" | "CHECK_BAY" | "WORKSHOP" | "BAY"; orgUnitId: string; archived: boolean };
export type UnitOption = { id: string; label: string };

const KINDS: { value: WorkshopRow["kind"]; label: string }[] = [
    { value: "RECEPTION", label: "Reception" },
    { value: "CHECK_BAY", label: "Check bay" },
    { value: "WORKSHOP", label: "Workshop" },
    { value: "BAY", label: "Bay" },
];

/**
 * Where vehicles are: the workshops and bays the council has, the unit that
 * runs each (whose divisional head approves its requisitions), and its foremen.
 */
export function WorkshopSettings({ tenant, workshops, units, foremen, people }: { tenant: string; workshops: WorkshopRow[]; units: UnitOption[]; foremen: (Appointment & { workshopId: string })[]; people: Person[] }) {
    const [adding, setAdding] = useState(false);
    const [state, appoint, appointing] = useAction(appointAction.bind(null, tenant));
    const open = workshops.filter((w) => !w.archived);
    return (
        <Panel
            title="Workshops and bays"
            action={!adding && <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setAdding(true)} disabled={units.length === 0}><Plus className="mr-1 h-3.5 w-3.5" aria-hidden />Add</Button>}
            footer="A requisition comes from the workshop the vehicle is in. Its foreman signs first, then the divisional head of the unit that runs it."
        >
            {units.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">Add the unit of your organisation that runs the workshop first, in Organisation.</p>}
            {units.length > 0 && workshops.length === 0 && !adding && <p className="px-4 py-6 text-sm text-slate-500">No workshops or bays yet. Add each one the council has: reception, the check bay, every workshop and bay.</p>}
            <ul className="divide-y divide-slate-100">
                {workshops.map((w) => (
                    <WorkshopLine key={w.id} tenant={tenant} workshop={w} units={units} foremen={foremen.filter((f) => f.workshopId === w.id)} />
                ))}
                {adding && <WorkshopLine tenant={tenant} workshop={null} units={units} foremen={[]} onDone={() => setAdding(false)} />}
            </ul>
            {open.length > 0 && (
                <form action={appoint} className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
                    <input type="hidden" name="kind" value="FOREMAN" />
                    <span className="text-xs text-slate-500">Foreman for</span>
                    <select name="workshopId" required defaultValue="" aria-label="Workshop" className={`${field} min-w-0`}>
                        <option value="" disabled>Workshop or bay</option>
                        {open.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <PersonSelect people={people} label="Person" />
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" name="deputy" className="accent-teal-700" />Deputy</label>
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={appointing}>{appointing ? "Appointing…" : "Appoint"}</Button>
                    <div className="w-full"><Outcome state={state} /></div>
                </form>
            )}
        </Panel>
    );
}

function WorkshopLine({ tenant, workshop, units, foremen, onDone }: { tenant: string; workshop: WorkshopRow | null; units: UnitOption[]; foremen: Appointment[]; onDone?: () => void }) {
    const [state, action, saving] = useAction(async (prev, formData) => {
        const result = await saveWorkshopAction(tenant, workshop?.id ?? null, prev, formData);
        if (result.ok && !workshop) onDone?.();
        return result;
    });
    const archived = workshop?.archived ?? false;
    return (
        <li className={`space-y-2 px-4 py-3 ${archived ? "opacity-60" : ""}`}>
            <form action={action} className="grid grid-cols-12 items-center gap-2">
                <input name="name" defaultValue={workshop?.name} required placeholder="e.g. Heavy duty vehicles" aria-label="Name" disabled={archived} className={`${field} col-span-12 font-medium sm:col-span-4`} />
                <select name="kind" defaultValue={workshop?.kind ?? "WORKSHOP"} aria-label="Kind" disabled={archived} className={`${field} col-span-5 sm:col-span-2`}>
                    {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <select name="orgUnitId" defaultValue={workshop?.orgUnitId ?? ""} required aria-label="Run by" disabled={archived} className={`${field} col-span-7 min-w-0 sm:col-span-4`}>
                    <option value="" disabled>Run by</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
                <span className="col-span-12 flex items-center justify-end gap-3 sm:col-span-2">
                    {!archived && <Button type="submit" size="sm" variant="outline" className="h-7" disabled={saving}>{saving ? "…" : workshop ? "Save" : "Add"}</Button>}
                    {workshop && <ArchiveButton archived={archived} label={workshop.name} onToggle={(a) => archiveWorkshopAction(tenant, workshop.id, a)} />}
                    {!workshop && <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onDone}>Cancel</Button>}
                </span>
            </form>
            <Outcome state={state} />
            {workshop && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-500">Foremen</span>
                    {foremen.length === 0 ? <span className="text-amber-700">None yet. Nothing from here can be approved until one is appointed.</span> : foremen.map((f) => <AppointedChip key={f.id} appointment={f} onRemove={(id) => revokeAction(tenant, id)} />)}
                </div>
            )}
        </li>
    );
}
