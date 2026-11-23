import type { DocumentState, DocumentType, JobStatus } from "@prisma/client";
import { Ban, CircleCheck, FileCheck2, PencilLine, type LucideIcon } from "lucide-react";
import { blockStatus } from "@/components/diary/shared";

/**
 * A status as SAP marks an object's: an icon and its words in a hairline
 * frame. Never a tint alone, which tells nobody who cannot see it which job is
 * waiting for parts; the only colour is red on Void, because Void is a verdict.
 */
export function ObjectStatus({ icon: Icon, label, tone = "text-slate-800", className = "" }: { icon: LucideIcon; label: string; tone?: string; className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-slate-200 bg-white px-1.5 py-0.5 text-[12px] font-medium leading-tight ${tone} ${className}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            {label}
        </span>
    );
}

export function JobStatusPill({ status, className = "" }: { status: JobStatus; className?: string }) {
    const { label, Icon } = blockStatus(status);
    return <ObjectStatus icon={Icon} label={label} className={className} />;
}

const STATE: Record<DocumentState, { label: string; icon: LucideIcon; tone?: string }> = {
    DRAFT: { label: "Draft", icon: PencilLine, tone: "text-slate-700" },
    PROCESSED: { label: "Processed", icon: FileCheck2 },
    CLOSED: { label: "Paid", icon: CircleCheck },
    VOID: { label: "Void", icon: Ban, tone: "text-red-700" },
};

/**
 * CLOSED is reached only by a document that settles — an invoice, a cash sale
 * or a credit note — once nothing is outstanding on it. For the first two that
 * is "Paid"; a credit note is not paid, it is used up, so it reads "Settled".
 * "Closed" stays the internal name.
 */
export function StatePill({ state, type }: { state: DocumentState; type?: DocumentType }) {
    const s = STATE[state];
    const label = state === "CLOSED" && type === "CREDIT" ? "Settled" : s.label;
    return <ObjectStatus icon={s.icon} label={label} tone={s.tone} />;
}
