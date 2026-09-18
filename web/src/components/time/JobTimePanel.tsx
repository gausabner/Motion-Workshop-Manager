import { AlertTriangle, Clock } from "lucide-react";
import { AddTimeForm, DeleteTimeButton, StopClockButton } from "@/components/time/JobTimeForm";
import type { jobTime } from "@/lib/time/queries";
import { hoursLabel } from "@/lib/time/clock";

type Time = Awaited<ReturnType<typeof jobTime>>;

const when = (d: Date) => d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Windhoek" });

/**
 * Time on a job, set against its estimate and what it was charged. The
 * charged figure comes from the invoice once there is one; before that it is
 * only the job card's intention, and it says so.
 */
export function JobTimePanel({ tenant, documentId, time, mechanics, canEdit }: { tenant: string; documentId: string; time: Time; mechanics: { id: string; name: string }[]; canEdit: boolean }) {
    const over = time.estimated !== null && time.worked > time.estimated;
    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <h3 className="flex items-center gap-2 px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Clock className="w-3.5 h-3.5" />Time</h3>
            <dl className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100">
                <div className="px-4 py-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">Worked</dt><dd className={`text-sm font-semibold tabular-nums ${over ? "text-amber-700" : "text-slate-800"}`}>{hoursLabel(time.worked)}</dd></div>
                <div className="px-4 py-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">Estimated</dt><dd className="text-sm tabular-nums text-slate-700">{time.estimated !== null ? hoursLabel(time.estimated) : "—"}</dd></div>
                <div className="px-4 py-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">{time.invoiced ? "Charged" : "On the job card"}</dt><dd className="text-sm tabular-nums text-slate-700">{time.charged ? hoursLabel(time.charged) : "No labour lines"}</dd></div>
                <div className="px-4 py-3"><dt className="text-[10px] uppercase tracking-wider text-slate-400">Efficiency</dt><dd className="text-sm tabular-nums text-slate-700">{time.efficiency !== null ? `${time.efficiency}%` : time.invoiced ? "—" : "When invoiced"}</dd></div>
            </dl>
            {time.rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">No time recorded. Mechanics clock on from their phones at /{tenant}/pwa.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {time.rows.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                            <span className="text-slate-700">
                                <strong className="font-medium">{r.mechanic}</strong>
                                <span className="text-slate-500"> · {when(r.startedAt)}{r.endedAt ? ` → ${when(r.endedAt)}` : ""}</span>
                                {r.source === "MANUAL" && <span className="ml-1 rounded-sm bg-slate-100 px-1 text-[10px] uppercase text-slate-500">added</span>}
                                {r.note && <span className="text-slate-400"> · {r.note}</span>}
                            </span>
                            <span className="flex items-center gap-3">
                                {r.suspect && <span className="flex items-center gap-1 text-xs text-amber-800"><AlertTriangle className="w-3.5 h-3.5" />Over ten hours — forgotten clock-off?</span>}
                                <span className={`tabular-nums ${r.running ? "font-semibold text-teal-700" : "text-slate-600"}`}>{r.running ? `running · ${hoursLabel(r.minutes)}` : hoursLabel(r.minutes)}</span>
                                {canEdit && r.running && <StopClockButton tenant={tenant} membershipId={r.mechanicId} name={r.mechanic} />}
                                {canEdit && !r.running && <DeleteTimeButton tenant={tenant} entryId={r.id} />}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {canEdit && <div className="border-t border-slate-100 px-4 py-2"><AddTimeForm tenant={tenant} documentId={documentId} mechanics={mechanics} /></div>}
        </section>
    );
}
