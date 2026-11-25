"use client";

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Repeat2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialActionState, type ActionState } from "@/lib/forms";

/**
 * The pieces the council's settings screens share: a ruled panel with a band
 * naming what it holds, the line that says what came of a save, a person
 * picker, and the small removable record of who is appointed to what.
 */

export type Person = { id: string; name: string; designations: string[] };
/** An appointment or a place on a staff. `note` says what as, where a deputy flag does not: "Mechanic". */
export type Appointment = { id: string; membershipId: string; name: string; deputy: boolean; note?: string };

/** Put somebody else in the same place in one step. */
export type Replace = { people: Person[]; run: (id: string, membershipId: string) => Promise<ActionState> };

/** A titled panel. Settings read at a measure; `wide` lets a panel fill its column, as on the job card. */
export function Panel({ title, action, children, footer, wide = false, level = 3 }: { title: string; action?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; level?: 2 | 3 }) {
    // A settings page's panels sit under its h3 heading; the job card's sit straight under its h1.
    const Heading = level === 2 ? "h2" : "h3";
    return (
        <section className={`${wide ? "" : "max-w-4xl "}border border-slate-200 bg-white`}>
            <div className="flex min-h-10 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
                <Heading className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</Heading>
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

/**
 * `useAction` for an action that does not revalidate: once it has answered
 * well, the page is refreshed outside the action's transition, so a refresh
 * that is slow or dropped leaves the page a moment stale rather than the
 * button stuck on its pending label. Used by the On site board; the job card's
 * route panel goes further and shows what the move answers (`lib/fleet/actions.ts`).
 */
export function useMove(run: (prev: ActionState, formData: FormData) => Promise<ActionState>) {
    const result = useActionState(run, initialActionState);
    const router = useRouter();
    const [state] = result;
    useEffect(() => {
        if (state.ok) router.refresh();
    }, [state, router]);
    return result;
}

/**
 * A form field on the council screens. Placeholders in slate-500 (4.8:1 on white), never the browser's faded half-tone;
 * a disabled field reads as one, on the sunken ground, so nobody types into a box that will not take it.
 */
export const field =
    "h-8 rounded-sm border border-slate-300 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-700 focus:outline-none disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-500";

export function PersonSelect({ people, name = "membershipId", label }: { people: Person[]; name?: string; label: string }) {
    return (
        <select name={name} required defaultValue="" aria-label={label} className={`${field} min-w-0 max-w-full`}>
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

/**
 * One appointment, with the means to end it and, where offered, to hand it to
 * somebody else in one step. Ending it stops new signatures only; the ones
 * given stay.
 */
export function AppointedChip({ appointment, onRemove, replace }: { appointment: Appointment; onRemove: (id: string) => Promise<ActionState>; replace?: Replace }) {
    const [pending, start] = useTransition();
    const [replacing, setReplacing] = useState(false);
    const [said, setSaid] = useState<ActionState | null>(null);
    const icon = "relative hit-area grid h-5 w-5 place-items-center text-slate-500 disabled:opacity-40";
    const swap = (formData: FormData) =>
        start(async () => {
            const answer = await replace!.run(appointment.id, String(formData.get("membershipId") ?? ""));
            setSaid(answer.ok ? null : answer);
            if (answer.ok) setReplacing(false);
        });
    return (
        <>
            <span className="inline-flex items-center gap-1 border border-slate-200 bg-white py-0.5 pl-2 pr-0.5 text-xs text-slate-700">
                {appointment.name}
                {appointment.note ? <span className="text-slate-500">· {appointment.note}</span> : appointment.deputy && <span className="text-slate-500">(deputy)</span>}
                {replace && (
                    <button type="button" disabled={pending} onClick={() => setReplacing((r) => !r)} aria-expanded={replacing} aria-label={`Replace ${appointment.name}`} className={`${icon} hover:text-teal-700`}>
                        <Repeat2 className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                    </button>
                )}
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => start(async () => void (await onRemove(appointment.id)))}
                    aria-label={`Remove ${appointment.name}`}
                    className={`${icon} hover:text-red-700`}
                >
                    <X className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                </button>
            </span>
            {replacing && replace && (
                <form action={swap} className="flex basis-full flex-wrap items-center gap-2 py-1">
                    <span className="text-xs text-slate-600">Replace {appointment.name} with</span>
                    <PersonSelect people={replace.people.filter((p) => p.id !== appointment.membershipId)} label="Person" />
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={pending}>{pending ? "Replacing…" : "Replace"}</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setReplacing(false)}>Cancel</Button>
                </form>
            )}
            {said && <p role="alert" className="basis-full text-xs text-red-700">{said.message}</p>}
        </>
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
