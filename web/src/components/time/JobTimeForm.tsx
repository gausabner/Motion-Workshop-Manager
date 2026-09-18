"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/forms/fields";
import { initialActionState } from "@/lib/forms";
import { addTimeEntry, deleteTimeEntry, stopClockFor } from "@/lib/time/actions";

/** Correcting the clock from the counter: add forgotten time, remove a mistake, stop a clock left running. */
export function AddTimeForm({ tenant, documentId, mechanics }: { tenant: string; documentId: string; mechanics: { id: string; name: string }[] }) {
    const [open, setOpen] = useState(false);
    const [state, action, saving] = useActionState(addTimeEntry.bind(null, tenant, documentId), initialActionState);
    if (!open) {
        return <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5 mr-1" />Add time</Button>;
    }
    const e = state.errors;
    return (
        <form action={action} className="grid w-full grid-cols-1 gap-3 md:grid-cols-5 md:items-end">
            <SelectField label="Mechanic" name="mechanicId" errors={e} allowEmpty="Choose…" options={mechanics.map((m) => ({ value: m.id, label: m.name }))} />
            <TextField label="Started" name="startedAt" type="datetime-local" errors={e} />
            <TextField label="Finished" name="endedAt" type="datetime-local" errors={e} />
            <TextField label="Note" name="note" errors={e} placeholder="Forgot to clock on…" />
            <div className="flex gap-2">
                <Button type="submit" size="sm" className="h-8 bg-teal-600 hover:bg-teal-700" disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>Close</Button>
            </div>
            {state.message && <p className={`md:col-span-5 text-xs ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</p>}
        </form>
    );
}

export function DeleteTimeButton({ tenant, entryId }: { tenant: string; entryId: string }) {
    const [confirming, setConfirming] = useState(false);
    const [pending, start] = useTransition();
    if (!confirming) return <button type="button" onClick={() => setConfirming(true)} className="text-slate-400 hover:text-red-600" aria-label="Remove this time"><Trash2 className="w-4 h-4" /></button>;
    return (
        <span className="inline-flex items-center gap-2 text-xs">
            <button type="button" disabled={pending} onClick={() => start(() => deleteTimeEntry(tenant, entryId))} className="font-medium text-red-700 hover:underline">Remove</button>
            <button type="button" onClick={() => setConfirming(false)} className="text-slate-400">Keep</button>
        </span>
    );
}

export function StopClockButton({ tenant, membershipId, name }: { tenant: string; membershipId: string; name: string }) {
    const [pending, start] = useTransition();
    return (
        <button type="button" disabled={pending} onClick={() => start(() => stopClockFor(tenant, membershipId))} className="text-xs font-medium text-teal-700 hover:underline">
            {pending ? "Stopping…" : `Stop ${name.split(" ")[0]}'s clock`}
        </button>
    );
}
