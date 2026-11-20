import Link from "next/link";
import type { RequisitionState } from "@prisma/client";
import { Panel } from "@/components/settings/council/shared";
import { RaiseButton } from "@/components/requisitions/RaiseButton";
import { STATE_LABEL } from "@/lib/requisitions/view";

/**
 * The job's requisitions on its job card: what has been asked for, where each
 * request is, and "Request parts" to raise another, already charged to the job.
 */
export function JobParts({ tenant, documentId, rows, canRaise }: { tenant: string; documentId: string; rows: { id: string; number: string | null; state: RequisitionState; items: string }[]; canRaise: boolean }) {
    return (
        <Panel wide level={2} title="Parts" action={canRaise ? <RaiseButton tenant={tenant} documentId={documentId} label="Request parts" /> : undefined}>
            {rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">No parts requested on this job yet.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {rows.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                            <Link href={`/${tenant}/dashboard/requisitions/${r.id}`} className="font-medium text-slate-900 hover:text-teal-700">{r.number ?? "Draft requisition"}</Link>
                            <span className="min-w-0 flex-1 truncate text-slate-600">{r.items || "No items yet"}</span>
                            <span className="text-xs text-slate-700">{STATE_LABEL[r.state]}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
