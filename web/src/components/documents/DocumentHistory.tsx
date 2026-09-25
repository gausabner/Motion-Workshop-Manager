import { CircleDot } from "lucide-react";
import type { AuditRow } from "@/lib/audit/queries";
import { actionDetail, actionWords } from "@/lib/audit/words";

/**
 * Who did what to this document, and when.
 *
 * The events have been recorded since the beginning and shown nowhere. A
 * workshop argument — "this invoice was six thousand yesterday", "who cancelled
 * that job card" — is settled by this panel or by nobody, and until now the
 * answer existed in the database where no one could reach it.
 *
 * Deliberately plain. It is read when something has gone wrong or is disputed,
 * which is not the moment for decoration.
 */

const when = (d: Date, timeZone: string) =>
    d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone });

export function DocumentHistory({ rows, timezone }: { rows: AuditRow[]; timezone: string }) {
    return (
        <section className="rounded-sm border border-slate-200 bg-white">
            <h3 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                History
            </h3>
            {rows.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">Nothing recorded against this document yet.</p>
            ) : (
                <ol className="divide-y divide-slate-100">
                    {rows.map((row) => {
                        const extra = actionDetail(row.action, row.diff);
                        return (
                            <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                                <CircleDot className="mt-1 h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-slate-800">
                                        {actionWords(row.action)}
                                        {/* An event with no actor came from the customer's own
                                            device — an approval from a share link — or from the
                                            system. Saying so beats an empty space. */}
                                        <span className="text-slate-500">
                                            {row.actor ? ` by ${row.actor}` : " — not by a signed-in user"}
                                        </span>
                                    </p>
                                    {extra && <p className="truncate text-xs text-slate-500">{extra}</p>}
                                </div>
                                <time className="shrink-0 text-xs tabular-nums text-slate-400">{when(row.at, timezone)}</time>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}
