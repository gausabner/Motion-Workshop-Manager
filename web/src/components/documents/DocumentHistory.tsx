import { CircleDot } from "lucide-react";
import type { AuditRow } from "@/lib/audit/queries";

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

/** Plain words for what happened, in the workshop's own terms. */
const SAID: Record<string, string> = {
    CREATED: "Created",
    UPDATED: "Edited",
    PROCESSED: "Processed",
    VOIDED: "Voided",
    DELETED: "Deleted",
    SENT: "Sent to the customer",
    STATUS_CHANGED: "Job status changed",
    RESCHEDULED: "Moved in the diary",
    APPROVED: "Approved by the customer",
    DECLINED: "Declined by the customer",
    SPLIT: "Split",
    CONVERTED: "Converted",
};

const when = (d: Date, timeZone: string) =>
    d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone });

/**
 * A change worth spelling out, rather than a JSON blob.
 *
 * Only the shapes actually written are handled; anything else is left off
 * rather than printed raw, because a line of braces in front of somebody
 * settling an argument is worse than no line at all.
 */
function detail(action: string, diff: unknown): string | null {
    if (!diff || typeof diff !== "object") return null;
    const d = diff as Record<string, unknown>;

    if (action === "RESCHEDULED" && typeof d.from === "string" && typeof d.to === "string") {
        return `${String(d.from).replace("T", " ")} → ${String(d.to).replace("T", " ")}`;
    }
    if (action === "STATUS_CHANGED" && (d.from || d.to)) {
        return `${String(d.from ?? "—").toLowerCase().replace(/_/g, " ")} → ${String(d.to ?? "—").toLowerCase().replace(/_/g, " ")}`;
    }
    if (action === "CREATED" && typeof d.type === "string") return String(d.type).toLowerCase().replace(/_/g, " ");
    if (typeof d.reason === "string") return d.reason;
    return null;
}

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
                        const extra = detail(row.action, row.diff);
                        return (
                            <li key={row.id} className="flex items-start gap-3 px-4 py-2.5">
                                <CircleDot className="mt-1 h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-slate-800">
                                        {SAID[row.action] ?? row.action.toLowerCase().replace(/_/g, " ")}
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
