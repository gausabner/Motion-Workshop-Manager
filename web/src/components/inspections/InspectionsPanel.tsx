import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startInspection } from "@/lib/inspections/actions";
import type { inspectionsForDocument } from "@/lib/inspections/queries";

const LABEL = { DRAFT: "Draft", REQUESTED: "With the customer", APPROVED: "Answered", REFUSED: "All declined", FINALISED: "Finalised" } as const;

export function InspectionsPanel({ tenant, documentId, rows, canStart }: { tenant: string; documentId: string; rows: Awaited<ReturnType<typeof inspectionsForDocument>>; canStart: boolean }) {
    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><ClipboardCheck className="w-3.5 h-3.5" />Inspections</h3>
                {canStart && (
                    <form action={startInspection.bind(null, tenant, documentId, undefined)}>
                        <Button type="submit" size="sm" variant="outline" className="h-7"><Plus className="w-3.5 h-3.5 mr-1" />Start inspection</Button>
                    </form>
                )}
            </div>
            {rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">No inspection on this job yet.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {rows.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                            <Link href={`/${tenant}/dashboard/inspections/${r.id}`} className="font-medium text-slate-700 hover:text-teal-700">{r.description} {r.number}</Link>
                            <span className="flex items-center gap-3 text-xs">
                                {r.red > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">{r.red} urgent</span>}
                                {r.amber > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{r.amber} soon</span>}
                                {r.approved > 0 && <span className="text-teal-700">{r.approved} approved</span>}
                                <span className="text-slate-500">{LABEL[r.state]}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
