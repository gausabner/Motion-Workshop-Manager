"use client";

import { Button } from "@/components/ui/button";
import { appointAction, revokeAction, saveRequisitionRules } from "@/lib/requisitions/settings-actions";
import { AppointedChip, Outcome, Panel, PersonSelect, field, useAction, type Appointment, type Person } from "@/components/settings/council/shared";

type Rules = { overLimitAt: number | null; reapprovalTolerancePercent: number; quoteBands: { from: number; quotes: number }[] };

const BANDS = 6;

/**
 * The council's own figures. MOTION holds none of its own: procurement
 * thresholds change, and each council sets its approvals below them.
 */
export function RequisitionRules({ tenant, rules, approvers, people, currency }: { tenant: string; rules: Rules; approvers: Appointment[]; people: Person[]; currency: string }) {
    const [state, action, saving] = useAction(saveRequisitionRules.bind(null, tenant));
    const [appointState, appoint, appointing] = useAction(appointAction.bind(null, tenant));
    const bands = [...rules.quoteBands, ...Array.from({ length: Math.max(0, BANDS - rules.quoteBands.length) }, () => null)].slice(0, BANDS);
    const money = currency === "NAD" ? "N$" : currency === "ZAR" ? "R" : currency;
    return (
        <div className="space-y-6">
            <Panel title="Approval" footer="Every requisition is approved by the workshop's foreman and then the divisional head. At or above the limit, one of the approvers below signs as well.">
                <form action={action} className="space-y-4 px-4 py-3">
                    <div className="flex flex-wrap items-end gap-4">
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                            Value limit, excluding VAT ({money})
                            <input name="overLimitAt" inputMode="decimal" defaultValue={rules.overLimitAt ?? ""} placeholder="No limit" className={`${field} w-44 tabular-nums`} />
                        </label>
                        <label className="grid gap-1 text-xs font-medium text-slate-700">
                            Order may exceed the approved value by (%)
                            <input name="reapprovalTolerancePercent" inputMode="decimal" defaultValue={rules.reapprovalTolerancePercent} required className={`${field} w-28 tabular-nums`} />
                        </label>
                    </div>
                    <fieldset className="space-y-2">
                        <legend className="text-xs font-medium text-slate-700">Quotations a purchase needs</legend>
                        <p className="text-[11px] text-slate-500">From each amount upwards, excluding VAT, at the chosen quotation&rsquo;s value. Leave a row blank to drop it.</p>
                        <table className="text-sm">
                            <thead>
                                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    <th scope="col" className="pb-1 pr-3 font-semibold">From ({money})</th>
                                    <th scope="col" className="pb-1 font-semibold">Quotations</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bands.map((band, i) => (
                                    <tr key={i}>
                                        <td className="py-0.5 pr-3"><input name={`band_from_${i}`} inputMode="decimal" defaultValue={band?.from ?? ""} aria-label={`Band ${i + 1} from`} className={`${field} w-36 tabular-nums`} /></td>
                                        <td className="py-0.5"><input name={`band_quotes_${i}`} inputMode="numeric" defaultValue={band?.quotes ?? ""} aria-label={`Band ${i + 1} quotations`} className={`${field} w-20 tabular-nums`} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </fieldset>
                    <div className="flex items-center gap-3">
                        <Button type="submit" size="sm" className="h-8 bg-teal-700 hover:bg-teal-800" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                        <Outcome state={state} />
                    </div>
                </form>
            </Panel>

            <Panel title="Approvers above the value limit" footer="Usually the procurement officer or the accounting officer. They need no other duties in MOTION.">
                <div className="flex flex-wrap gap-1.5 px-4 py-3">
                    {approvers.length === 0 ? <span className="text-sm text-slate-500">Nobody yet. Requisitions at or above the limit cannot be submitted until somebody is appointed.</span> : approvers.map((a) => <AppointedChip key={a.id} appointment={a} onRemove={(id) => revokeAction(tenant, id)} />)}
                </div>
                <form action={appoint} className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-4 py-3">
                    <input type="hidden" name="kind" value="OVER_LIMIT" />
                    <PersonSelect people={people} label="Person" />
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={appointing}>{appointing ? "Appointing…" : "Appoint"}</Button>
                    <div className="w-full"><Outcome state={appointState} /></div>
                </form>
            </Panel>
        </div>
    );
}
