import type { ReactNode } from "react";

export type Fact = { label: string; value: ReactNode; figure?: boolean };

/**
 * The top of a record, laid out as SAP's object page header in MOTION's own
 * look: what it is and where it stands on the left, what can be done with it
 * on the right, and a row of the facts and figures somebody opens it to read.
 * Hairlines, not cards; figures tabular; statuses an icon and their words.
 */
export function ObjectHeader({ icon, title, status, actions, facts = [] }: { icon?: ReactNode; title: ReactNode; status?: ReactNode; actions?: ReactNode; facts?: Fact[] }) {
    return (
        <header className="border border-slate-200 bg-white">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 py-3">
                <div className="flex min-w-0 items-start gap-3">
                    {icon}
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold leading-tight tracking-[-0.01em] text-slate-900">{title}</h1>
                        {status && (
                            <div role="group" aria-label="Status" className="mt-1.5 flex flex-wrap items-center gap-2">
                                {status}
                            </div>
                        )}
                    </div>
                </div>
                {actions}
            </div>
            {/* Cells fill the row whatever their number; each carries a hairline
                right and below, and the frame hides the outer ones. */}
            {facts.length > 0 && (
                <div className="overflow-hidden border-t border-slate-200">
                    {/* minmax(0, …) so a long value wraps or truncates inside its cell instead of widening the page on a phone. */}
                    <dl className="-mb-px -mr-px grid grid-cols-[repeat(2,minmax(0,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
                        {facts.map((fact) => (
                            <div key={fact.label} className="min-w-0 border-b border-r border-slate-100 px-4 py-2.5">
                                <dt className="text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">{fact.label}</dt>
                                <dd className={`mt-0.5 ${fact.figure ? "text-[15px] font-semibold tabular-nums text-slate-900" : "break-words text-sm text-slate-800"}`}>{fact.value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            )}
        </header>
    );
}
