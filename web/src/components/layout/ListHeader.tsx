import type { LucideIcon } from "lucide-react";

/**
 * The head of a list, as SAP's list report has it, in MOTION's band: what the
 * list is and how many records it holds on the left, its search, filters and
 * actions on the right. One header for every list, so a person who has learnt
 * one has learnt them all.
 */
export function ListHeader({ icon: Icon, title, count, noun, extra, children }: { icon: LucideIcon; title: string; count?: number; noun?: string; extra?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div className="flex flex-col items-stretch gap-2 border-b border-slate-200 bg-slate-200 px-4 py-2 sm:min-h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <Icon className="h-5 w-5 shrink-0 self-center text-slate-600" aria-hidden="true" />
                <h1 className="whitespace-nowrap text-lg font-bold leading-none text-slate-800">{title}</h1>
                {count !== undefined && (
                    <span className="text-sm tabular-nums text-slate-600">
                        {count.toLocaleString("en-NA")}
                        {noun && <span className="sr-only"> {noun}</span>}
                    </span>
                )}
                {extra}
            </div>
            {children && <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">{children}</div>}
        </div>
    );
}
