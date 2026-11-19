"use client";

import { Button } from "@/components/ui/button";
import { saveDesignationsAction } from "@/lib/requisitions/settings-actions";
import { Outcome, Panel, field, useAction } from "@/components/settings/council/shared";

type Member = { id: string; name: string; role: string; designations: string[]; payNumber: string | null };

/**
 * The job titles each person signs under, and the pay number the council
 * writes beside a signature. A designation is not a role: an artisan and a
 * mechanic may do the same things in MOTION and still sign as themselves.
 */
export function DesignationsPanel({ tenant, members, designations }: { tenant: string; members: Member[]; designations: { value: string; label: string }[] }) {
    return (
        <Panel title="Designations and pay numbers" footer="Signatures on job cards and requisitions carry the person's designation and pay number as they stood when they signed.">
            <ul className="divide-y divide-slate-100">
                {members.map((m) => <MemberLine key={m.id} tenant={tenant} member={m} designations={designations} />)}
            </ul>
        </Panel>
    );
}

function MemberLine({ tenant, member, designations }: { tenant: string; member: Member; designations: { value: string; label: string }[] }) {
    const [state, action, saving] = useAction(saveDesignationsAction.bind(null, tenant, member.id));
    return (
        <li>
            <form action={action} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900">{member.name} <span className="font-normal text-slate-500">· {member.role}</span></p>
                    <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500" htmlFor={`pay-${member.id}`}>Pay No.</label>
                        <input id={`pay-${member.id}`} name="payNumber" defaultValue={member.payNumber ?? ""} maxLength={30} className={`${field} w-32 tabular-nums`} />
                        <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                    </div>
                </div>
                <fieldset className="flex flex-wrap gap-1.5">
                    <legend className="sr-only">Designations for {member.name}</legend>
                    {designations.map((d) => (
                        <label key={d.value} className="inline-flex cursor-pointer items-center gap-1.5 border border-slate-200 px-2 py-1 text-xs text-slate-700 has-[:checked]:border-teal-700 has-[:checked]:text-slate-900 pointer-coarse:min-h-11">
                            <input type="checkbox" name="designations" value={d.value} defaultChecked={member.designations.includes(d.value)} className="accent-teal-700" />
                            {d.label}
                        </label>
                    ))}
                </fieldset>
                <Outcome state={state} />
            </form>
        </li>
    );
}
