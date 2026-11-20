import Link from "next/link";
import type { RequisitionState } from "@prisma/client";
import { Panel } from "@/components/settings/council/shared";
import { RaiseButton } from "@/components/requisitions/RaiseButton";

/**
 * The job's requisitions on its job card: what has been asked for, where each
 * request is, what the job is still waiting for while one is open, and
 * "Request parts" to raise another, already charged to the job.
 */
export function JobParts({
    tenant,
    documentId,
    rows,
    canRaise,
}: {
    tenant: string;
    documentId: string;
    rows: { id: string; number: string | null; state: RequisitionState; stateLabel: string; items: string; waitingFor: string | null }[];
    canRaise: boolean;
}) {
    return (
        <Panel wide level={2} title="Parts" action={canRaise ? <RaiseButton tenant={tenant} documentId={documentId} label="Request parts" /> : undefined}>
            {rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-600">No parts requested on this job yet.</p>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {rows.map((r) => (
                        <li key={r.id} className="relative grid gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm hover:bg-slate-50 sm:grid-cols-[7rem_minmax(0,1fr)_auto]">
                            {/* The whole row opens it: a thumb finds a row, not a 20px number. */}
                            <Link href={`/${tenant}/dashboard/requisitions/${r.id}`} className="font-medium tabular-nums text-slate-900 after:absolute after:inset-0 hover:text-teal-700">
                                {r.number ?? "Draft requisition"}
                            </Link>
                            <span className="min-w-0 text-slate-600">
                                {r.waitingFor ? <>Waiting for {r.waitingFor}</> : r.items || "No items yet"}
                            </span>
                            <span className="text-xs text-slate-700 sm:text-right">{r.stateLabel}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}
