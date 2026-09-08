import type { DocumentState, JobStatus } from "@prisma/client";
import { JOB_STATUS_LABELS, JOB_STATUS_STYLES } from "@/lib/documents/types";

export function JobStatusPill({ status, className = "" }: { status: JobStatus; className?: string }) {
    return (
        <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${JOB_STATUS_STYLES[status]} ${className}`}>
            {JOB_STATUS_LABELS[status]}
        </span>
    );
}

const STATE_STYLES: Record<DocumentState, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-300",
    PROCESSED: "bg-green-50 text-green-700 border-green-300",
    VOID: "bg-red-50 text-red-700 border-red-300",
};

export function StatePill({ state }: { state: DocumentState }) {
    const label = state === "DRAFT" ? "Draft" : state === "PROCESSED" ? "Processed" : "Void";
    return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATE_STYLES[state]}`}>{label}</span>;
}
