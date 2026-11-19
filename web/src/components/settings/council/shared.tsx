"use client";

import { useActionState, useTransition, type ReactNode } from "react";
import { X } from "lucide-react";
import { initialActionState, type ActionState } from "@/lib/forms";

/**
 * The pieces the council's settings screens share: a ruled panel with a band
 * naming what it holds, the line that says what came of a save, a person
 * picker, and the small removable record of who is appointed to what.
 */

export type Person = { id: string; name: string; designations: string[] };
export type Appointment = { id: string; membershipId: string; name: string; deputy: boolean };

/** A titled panel. Settings read at a measure; `wide` lets a panel fill its column, as on the job card. */
export function Panel({ title, action, children, footer, wide = false }: { title: string; action?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
    return (
        <section className={`${wide ? "" : "max-w-4xl "}border border-slate-200 bg-white`}>
            <div className="flex min-h-10 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
                {action}
            </div>
            {children}
            {footer && <div className="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">{footer}</div>}
        </section>
    );
}

export function Outcome({ state }: { state: ActionState }) {
    if (!state.message) return null;
    return (
        <p role={state.ok ? "status" : "alert"} className={`text-xs ${state.ok ? "text-teal-700" : "text-red-700"}`}>
            {state.message}
        </p>
    );
}

/** `useActionState` for a server action that takes the form as its last argument. */
export function useAction(run: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
    return useActionState(run, initialActionState);
}

export const field = "h-8 rounded-sm border border-slate-300 bg-white px-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none";

export function PersonSelect({ people, name = "membershipId", label }: { people: Person[]; name?: string; label: string }) {
    return (
        <select name={name} required defaultValue="" aria-label={label} className={`${field} min-w-0`}>
            <option value="" disabled>
                {label}
            </option>
            {people.map((p) => (
                <option key={p.id} value={p.id}>
                    {p.name}
                    {p.designations.length ? ` — ${p.designations.join(", ")}` : ""}
                </option>
            ))}
        </select>
    );
}

/** One appointment, with the means to end it. Ending it stops new signatures only; the ones given stay. */
export function AppointedChip({ appointment, onRemove }: { appointment: Appointment; onRemove: (id: string) => Promise<ActionState> }) {
    const [pending, start] = useTransition();
    return (
        <span className="inline-flex items-center gap-1 border border-slate-200 bg-white py-0.5 pl-2 pr-0.5 text-xs text-slate-700">
            {appointment.name}
            {appointment.deputy && <span className="text-slate-500">(deputy)</span>}
            <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => void (await onRemove(appointment.id)))}
                aria-label={`Remove ${appointment.name}`}
                className="relative hit-area grid h-5 w-5 place-items-center text-slate-500 hover:text-red-700 disabled:opacity-40"
            >
                <X className="h-3 w-3" strokeWidth={1.75} aria-hidden />
            </button>
        </span>
    );
}

export function ArchiveButton({ archived, onToggle, label }: { archived: boolean; onToggle: (archived: boolean) => Promise<ActionState>; label: string }) {
    const [pending, start] = useTransition();
    const [state, setState] = useActionState((_: ActionState, next: ActionState) => next, initialActionState);
    return (
        <span className="inline-flex items-center gap-2">
            <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => setState(await onToggle(!archived)))}
                className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-40"
                aria-label={`${archived ? "Restore" : "Archive"} ${label}`}
            >
                {archived ? "Restore" : "Archive"}
            </button>
            {state.message && !state.ok && <span className="text-xs text-red-700">{state.message}</span>}
        </span>
    );
}
