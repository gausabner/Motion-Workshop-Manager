"use client";

import { Button } from "@/components/ui/button";
import { saveJobCardSignatures } from "@/lib/fleet/actions";
import { Outcome, Panel, useAction } from "@/components/settings/council/shared";

const ROLES = [
    { value: "RECEPTION", label: "Reception" },
    { value: "DRIVER", label: "Driver" },
    { value: "FOREMAN", label: "Foreman" },
    { value: "FLEET_COORDINATOR", label: "Fleet Coordinator" },
    { value: "MECHANIC", label: "Mechanic" },
];

/** The signatures the council's paper job card asks for when it is issued. Nothing leaves reception until every one is on it. */
export function JobCardSignatures({ tenant, issueRoles }: { tenant: string; issueRoles: string[] }) {
    const [state, action, saving] = useAction(saveJobCardSignatures.bind(null, tenant));
    return (
        <Panel title="Signatures on the job card" footer="A vehicle leaves reception for the check bay only once every signature ticked here is on its job card.">
            <form action={action} className="space-y-3 px-4 py-3">
                <fieldset className="flex flex-wrap gap-1.5">
                    <legend className="mb-2 text-xs font-medium text-slate-700">Signed when the job card is issued</legend>
                    {ROLES.map((r) => (
                        <label key={r.value} className="inline-flex cursor-pointer items-center gap-1.5 border border-slate-200 px-2 py-1 text-xs text-slate-700 has-[:checked]:border-teal-700 has-[:checked]:text-slate-900 pointer-coarse:min-h-11">
                            <input type="checkbox" name="issueRoles" value={r.value} defaultChecked={issueRoles.includes(r.value)} className="accent-teal-700" />
                            {r.label}
                        </label>
                    ))}
                </fieldset>
                <div className="flex items-center gap-3">
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                    <Outcome state={state} />
                </div>
            </form>
        </Panel>
    );
}
