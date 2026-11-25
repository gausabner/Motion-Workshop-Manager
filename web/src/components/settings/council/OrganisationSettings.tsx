"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    appointAction,
    archiveOrgUnitAction,
    archiveVoteAction,
    importVotesAction,
    replaceAuthorityAction,
    revokeAction,
    saveOrganisationLevels,
    saveOrgUnitAction,
    saveVoteAction,
} from "@/lib/requisitions/settings-actions";
import { AppointedChip, ArchiveButton, Outcome, Panel, PersonSelect, field, useAction, type Appointment, type Person } from "@/components/settings/council/shared";

export type Unit = { id: string; name: string; parentId: string | null; archived: boolean };
export type VoteRow = { id: string; code: string; name: string; orgUnitId: string; archived: boolean };
export type UnitAppointment = Appointment & { kind: "DIVISION_HEAD" | "FLEET_COORDINATOR"; orgUnitId: string };

type Levels = { topLevel: string; secondLevel: string | null };

/**
 * The organisation that owns the vehicles and pays for them: its levels as
 * the council names them, its units, who signs for each unit, and its votes.
 */
export function OrganisationSettings({ tenant, levels, units, votes, appointments, people }: { tenant: string; levels: Levels; units: Unit[]; votes: VoteRow[]; appointments: UnitAppointment[]; people: Person[] }) {
    const active = units.filter((u) => !u.archived);
    const label = (u: Unit) => {
        const parent = u.parentId ? units.find((p) => p.id === u.parentId) : null;
        return parent ? `${parent.name} / ${u.name}` : u.name;
    };
    return (
        <div className="space-y-6">
            <LevelsForm tenant={tenant} levels={levels} />
            <UnitsPanel tenant={tenant} levels={levels} units={units} appointments={appointments} people={people} label={label} />
            <VotesPanel tenant={tenant} votes={votes} units={active} label={label} />
        </div>
    );
}

function LevelsForm({ tenant, levels }: { tenant: string; levels: Levels }) {
    const [state, action, saving] = useAction(saveOrganisationLevels.bind(null, tenant));
    const [two, setTwo] = useState(levels.secondLevel !== null);
    return (
        <Panel title="Levels">
            <form action={action} className="space-y-3 px-4 py-3">
                <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                    <legend className="sr-only">How many levels</legend>
                    <label className="inline-flex items-center gap-2"><input type="radio" name="levels" value="one" checked={!two} onChange={() => setTwo(false)} className="accent-teal-700" />One level</label>
                    <label className="inline-flex items-center gap-2"><input type="radio" name="levels" value="two" checked={two} onChange={() => setTwo(true)} className="accent-teal-700" />Two levels</label>
                </fieldset>
                <div className="flex flex-wrap items-end gap-3">
                    <label className="grid gap-1 text-xs font-medium text-slate-700">
                        Top level
                        <input name="topLevel" defaultValue={levels.topLevel} required maxLength={40} className={`${field} w-48`} />
                    </label>
                    {two && (
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                            Under it
                            <input name="secondLevel" defaultValue={levels.secondLevel ?? "Department"} required maxLength={40} className={`${field} w-48`} />
                        </label>
                    )}
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                </div>
                <Outcome state={state} />
            </form>
        </Panel>
    );
}

function UnitsPanel({ tenant, levels, units, appointments, people, label }: { tenant: string; levels: Levels; units: Unit[]; appointments: UnitAppointment[]; people: Person[]; label: (u: Unit) => string }) {
    const [adding, setAdding] = useState(false);
    const tops = units.filter((u) => !u.parentId);
    const plural = (s: string) => (s.endsWith("s") ? s : `${s}s`);
    return (
        <Panel
            title={levels.secondLevel ? `${plural(levels.topLevel)} and ${plural(levels.secondLevel).toLowerCase()}` : plural(levels.topLevel)}
            action={!adding && <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setAdding(true)}><Plus className="mr-1 h-3.5 w-3.5" aria-hidden />Add</Button>}
            footer="A divisional head or fleet coordinator signs for their unit and everything under it. Where a unit has its own, theirs is used instead."
        >
            {tops.length === 0 && !adding && <p className="px-4 py-6 text-sm text-slate-500">No units yet. Add the {levels.topLevel.toLowerCase()} that runs the workshop first.</p>}
            <ul className="divide-y divide-slate-100">
                {tops.map((top) => (
                    <li key={top.id}>
                        <UnitRow tenant={tenant} unit={top} levels={levels} tops={tops} appointments={appointments} people={people} />
                        {units.filter((u) => u.parentId === top.id).map((child) => (
                            <div key={child.id} className="ml-4 border-l border-slate-200">
                                <UnitRow tenant={tenant} unit={child} levels={levels} tops={tops} appointments={appointments} people={people} />
                            </div>
                        ))}
                    </li>
                ))}
                {adding && (
                    <li><NewUnit tenant={tenant} levels={levels} tops={tops.filter((t) => !t.archived)} onDone={() => setAdding(false)} /></li>
                )}
            </ul>
            <AppointForm tenant={tenant} units={units.filter((u) => !u.archived)} people={people} label={label} />
        </Panel>
    );
}

function UnitRow({ tenant, unit, levels, tops, appointments, people }: { tenant: string; unit: Unit; levels: Levels; tops: Unit[]; appointments: UnitAppointment[]; people: Person[] }) {
    const [state, action, saving] = useAction(saveOrgUnitAction.bind(null, tenant, unit.id));
    const mine = appointments.filter((a) => a.orgUnitId === unit.id);
    const heads = mine.filter((a) => a.kind === "DIVISION_HEAD");
    const coordinators = mine.filter((a) => a.kind === "FLEET_COORDINATOR");
    return (
        <div className={`space-y-2 px-4 py-3 ${unit.archived ? "opacity-60" : ""}`}>
            <form action={action} className="flex flex-wrap items-center gap-2">
                <input name="name" defaultValue={unit.name} required aria-label="Unit name" className={`${field} w-64 font-medium`} disabled={unit.archived} />
                {levels.secondLevel && unit.parentId && (
                    <select name="parentId" defaultValue={unit.parentId} aria-label={`The ${levels.topLevel.toLowerCase()} it sits under`} className={field} disabled={unit.archived}>
                        {tops.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                )}
                {!unit.archived && <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>}
                <ArchiveButton archived={unit.archived} label={unit.name} onToggle={(archived) => archiveOrgUnitAction(tenant, unit.id, archived)} />
            </form>
            <Outcome state={state} />
            {(heads.length > 0 || coordinators.length > 0) && (
                <dl className="grid gap-1.5 text-xs sm:grid-cols-[9rem_1fr]">
                    {heads.length > 0 && <><dt className="pt-1 text-slate-500">Divisional Head</dt><dd className="flex flex-wrap gap-1.5">{heads.map((a) => <AppointedChip key={a.id} appointment={a} onRemove={(id) => revokeAction(tenant, id)} replace={{ people, run: (id, who) => replaceAuthorityAction(tenant, id, who) }} />)}</dd></>}
                    {coordinators.length > 0 && <><dt className="pt-1 text-slate-500">Fleet Coordinator</dt><dd className="flex flex-wrap gap-1.5">{coordinators.map((a) => <AppointedChip key={a.id} appointment={a} onRemove={(id) => revokeAction(tenant, id)} replace={{ people, run: (id, who) => replaceAuthorityAction(tenant, id, who) }} />)}</dd></>}
                </dl>
            )}
        </div>
    );
}

function NewUnit({ tenant, levels, tops, onDone }: { tenant: string; levels: Levels; tops: Unit[]; onDone: () => void }) {
    const [state, action, saving] = useAction(async (prev, formData) => {
        const result = await saveOrgUnitAction(tenant, null, prev, formData);
        if (result.ok) onDone();
        return result;
    });
    return (
        <form action={action} className="flex flex-wrap items-center gap-2 bg-slate-50/60 px-4 py-3">
            <input name="name" required placeholder={`Name of the ${levels.topLevel.toLowerCase()}${levels.secondLevel ? ` or ${levels.secondLevel.toLowerCase()}` : ""}`} aria-label="Unit name" className={`${field} w-72`} autoFocus />
            {levels.secondLevel && (
                <select name="parentId" defaultValue="" aria-label="Where it sits" className={field}>
                    <option value="">A {levels.topLevel.toLowerCase()}</option>
                    {tops.map((t) => <option key={t.id} value={t.id}>A {levels.secondLevel!.toLowerCase()} under {t.name}</option>)}
                </select>
            )}
            <Button type="submit" size="sm" className="h-8 bg-teal-700 hover:bg-teal-800" disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onDone}>Cancel</Button>
            <div className="w-full"><Outcome state={state} /></div>
        </form>
    );
}

function AppointForm({ tenant, units, people, label }: { tenant: string; units: Unit[]; people: Person[]; label: (u: Unit) => string }) {
    const [state, action, saving] = useAction(appointAction.bind(null, tenant));
    if (units.length === 0) return null;
    return (
        <form action={action} className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
            <select name="kind" defaultValue="DIVISION_HEAD" aria-label="What they sign as" className={field}>
                <option value="DIVISION_HEAD">Divisional Head</option>
                <option value="FLEET_COORDINATOR">Fleet Coordinator</option>
            </select>
            <span className="text-xs text-slate-500">for</span>
            <select name="orgUnitId" required defaultValue="" aria-label="The unit" className={`${field} min-w-0`}>
                <option value="" disabled>Unit</option>
                {units.map((u) => <option key={u.id} value={u.id}>{label(u)}</option>)}
            </select>
            <PersonSelect people={people} label="Person" />
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700"><input type="checkbox" name="deputy" className="accent-teal-700" />Deputy</label>
            <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving}>{saving ? "Appointing…" : "Appoint"}</Button>
            <div className="w-full"><Outcome state={state} /></div>
        </form>
    );
}

function VotesPanel({ tenant, votes, units, label }: { tenant: string; votes: VoteRow[]; units: Unit[]; label: (u: Unit) => string }) {
    const [adding, setAdding] = useState(false);
    const [importing, setImporting] = useState(false);
    return (
        <Panel
            title="Votes"
            action={
                <span className="flex gap-2">
                    {!importing && <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setImporting(true)}>Import</Button>}
                    {!adding && <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => setAdding(true)} disabled={units.length === 0}><Plus className="mr-1 h-3.5 w-3.5" aria-hidden />Add</Button>}
                </span>
            }
            footer="Vote numbers are kept exactly as your finance system writes them, so the nightly journal posts to the same code."
        >
            {importing && <ImportVotes tenant={tenant} onDone={() => setImporting(false)} />}
            <div className="grid grid-cols-12 gap-2 px-4 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500" aria-hidden>
                <span className="col-span-3">Vote No.</span><span className="col-span-4">Name</span><span className="col-span-3">Unit</span>
            </div>
            {votes.length === 0 && !adding && <p className="px-4 py-6 text-sm text-slate-500">No votes yet. Add them one by one, or import the list from your finance system.</p>}
            <ul className="divide-y divide-slate-100">
                {votes.map((v) => <VoteLine key={v.id} tenant={tenant} vote={v} units={units} label={label} />)}
                {adding && <VoteLine tenant={tenant} vote={null} units={units} label={label} onDone={() => setAdding(false)} />}
            </ul>
        </Panel>
    );
}

function VoteLine({ tenant, vote, units, label, onDone }: { tenant: string; vote: VoteRow | null; units: Unit[]; label: (u: Unit) => string; onDone?: () => void }) {
    const [state, action, saving] = useAction(async (prev, formData) => {
        const result = await saveVoteAction(tenant, vote?.id ?? null, prev, formData);
        if (result.ok && !vote) onDone?.();
        return result;
    });
    const archived = vote?.archived ?? false;
    return (
        <li className={archived ? "opacity-60" : ""}>
            <form action={action} className="grid grid-cols-12 items-center gap-2 px-4 py-2">
                <input name="code" defaultValue={vote?.code} required placeholder="2000025105010" aria-label="Vote number" disabled={archived} className={`${field} col-span-3 font-mono tabular-nums`} />
                <input name="name" defaultValue={vote?.name} required placeholder="As the budget names it" aria-label="Vote name" disabled={archived} className={`${field} col-span-4`} />
                <select name="orgUnitId" defaultValue={vote?.orgUnitId ?? ""} required aria-label="Unit" disabled={archived} className={`${field} col-span-3 min-w-0`}>
                    <option value="" disabled>Unit</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{label(u)}</option>)}
                </select>
                <span className="col-span-2 flex items-center justify-end gap-3">
                    {!archived && <Button type="submit" size="sm" variant="outline" className="h-7" disabled={saving}>{saving ? "…" : vote ? "Save" : "Add"}</Button>}
                    {vote && <ArchiveButton archived={archived} label={`vote ${vote.code}`} onToggle={(a) => archiveVoteAction(tenant, vote.id, a)} />}
                </span>
                <div className="col-span-12"><Outcome state={state} /></div>
            </form>
        </li>
    );
}

function ImportVotes({ tenant, onDone }: { tenant: string; onDone: () => void }) {
    const [state, action, saving] = useAction(importVotesAction.bind(null, tenant));
    return (
        <form action={action} className="space-y-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
            <label htmlFor="vote-csv" className="block text-xs font-medium text-slate-700">
                Paste from your finance system: one vote per line — the vote number, its name, and its unit.
            </label>
            <textarea id="vote-csv" name="csv" rows={6} required spellCheck={false} placeholder={"2000025105010,Protective clothing,Fleet Management\n2000031204020,Vehicle maintenance,Community Services / Parks"} className="w-full rounded-sm border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 focus:border-teal-700 focus:outline-none" />
            <p className="text-[11px] text-slate-500">A vote already in the list is updated by its number. Where two units share a name, write it as “Division / Department”. Nothing is imported unless every line can be.</p>
            <div className="flex items-center gap-2">
                <Button type="submit" size="sm" className="h-8 bg-teal-700 hover:bg-teal-800" disabled={saving}>{saving ? "Importing…" : "Import"}</Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onDone}>Close</Button>
            </div>
            <Outcome state={state} />
        </form>
    );
}
