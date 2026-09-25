import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Download, Share2 } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { handoffSettings } from "@/lib/settings/schema";
import { missingDays } from "@/lib/handoff/run";
import { unconfirmed } from "@/lib/handoff/receipts";
import { SHAPE_LABELS, SHAPE_NOTES, shapeHeaders, type LedgerShapeName } from "@/lib/handoff/shapes";
import { resolveFolder } from "@/lib/handoff/destination";
import { businessToday } from "@/lib/tenant/today";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Hand-off | MOTION Workshop Manager" };

/**
 * Did last night's file go out, and did anybody take it?
 *
 * The whole reason this screen exists is that a one-way drop gives no feedback
 * of its own. A folder full of files looks identical whether the ERP is
 * importing them nightly or stopped in March, and without somewhere that says
 * which, the answer arrives at year end from an accountant.
 *
 * So it leads with the two failures that are silent: days the schedule never
 * covered, and files that went out and were never confirmed. Everything else
 * on the page is reference.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function HandoffPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ sent?: string; why?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();

    const settings = handoffSettings(tenant.settings);
    const shape = settings.shape as LedgerShapeName;
    const today = businessToday(tenant.timezone);
    const yesterday = new Date(today.getTime() - 86_400_000);
    const fortnightAgo = new Date(today.getTime() - 14 * 86_400_000);

    const [runs, missing, waiting] = await Promise.all([
        db.exportRun.findMany({ where: { kind: "JOURNAL" }, orderBy: { periodFrom: "desc" }, take: 20 }),
        settings.enabled ? missingDays(db, fortnightAgo, yesterday, shape) : Promise.resolve([]),
        settings.enabled ? unconfirmed(db) : Promise.resolve([]),
    ]);

    const base = `/${slug}/dashboard/reports/handoff`;
    const card = "rounded-sm border border-slate-200 bg-white";
    const folderNow = resolveFolder({ folder: settings.folder, tenantSlug: tenant.slug, day: yesterday });
    const lastGood = runs.find((r) => r.state === "DELIVERED" || r.state === "ACKNOWLEDGED");

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/reports`} className="text-xs font-medium text-teal-700 hover:underline">← Reports</Link>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><Share2 className="h-6 w-6 text-slate-400" />Hand-off</h1>
                <p className="text-sm text-slate-500">MOTION writes a file and the accounting system picks it up. Nothing listens on a port and nothing is exposed — which is also why this page exists, because a drop folder tells you nothing on its own.</p>
            </div>

            {sp.sent && (
                <p className={`rounded-sm border px-4 py-3 text-sm ${sp.sent === "failed" ? "border-amber-300 bg-amber-50 text-slate-800" : "border-teal-200 bg-teal-50 text-slate-800"}`}>
                    {sp.sent === "delivered" ? "Sent." : sp.sent === "skipped" ? "That day had already been sent. Nothing was written again." : `Not sent. ${sp.why ?? ""}`}
                </p>
            )}

            {!settings.enabled ? (
                <section className={`${card} px-4 py-3`}>
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Clock className="h-4 w-4 text-slate-400" />The nightly hand-off is off.</p>
                    <p className="mt-1 text-xs text-slate-600">
                        Turn it on in Settings once the account codes have been agreed with whoever keeps the books. A schedule that runs before that
                        posts a month of wrong codes into somebody&rsquo;s ledger, which is harder to undo than to delay.
                    </p>
                </section>
            ) : (
                <section className={`flex items-start gap-3 rounded-sm border px-4 py-3 ${missing.length === 0 && waiting.length === 0 ? "border-teal-200 bg-teal-50" : "border-amber-300 bg-amber-50"}`}>
                    {missing.length === 0 && waiting.length === 0
                        ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
                        : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />}
                    <div className="min-w-0 space-y-1">
                        {missing.length === 0
                            ? <p className="text-sm font-semibold text-slate-800">Every day of the last fortnight has been sent.</p>
                            : <p className="text-sm font-semibold text-slate-800">{missing.length} day{missing.length === 1 ? "" : "s"} in the last fortnight {missing.length === 1 ? "was" : "were"} never sent: {missing.slice(0, 6).map(dateShort).join(", ")}{missing.length > 6 ? "…" : ""}</p>}
                        {settings.receiptFolder.trim() === ""
                            ? <p className="text-xs text-slate-600">No receipt folder is set, so MOTION can say what it sent but not whether anything took it. Ask whoever runs the accounting system to write a file named after each one with <code className="rounded bg-white px-1">.ok</code> on the end.</p>
                            : waiting.length === 0
                                ? <p className="text-xs text-slate-600">Everything sent has been confirmed by the receiving system.</p>
                                : <p className="text-xs text-slate-600">{waiting.length} file{waiting.length === 1 ? "" : "s"} went out more than two days ago and {waiting.length === 1 ? "has" : "have"} not been confirmed — the oldest is {dateShort(iso(waiting[0].periodFrom))}. That is what an import that quietly stopped looks like.</p>}
                    </div>
                </section>
            )}

            <section className={`${card} px-4 py-3 text-sm`}>
                <h2 className="font-semibold text-slate-800">Where it goes</h2>
                <dl className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    <div className="flex gap-2"><dt className="text-slate-500">Shape</dt><dd className="font-medium text-slate-800">{SHAPE_LABELS[shape]}</dd></div>
                    <div className="flex gap-2"><dt className="text-slate-500">Folder</dt><dd className="font-mono text-xs text-slate-800">{folderNow || "(the root of the store)"}</dd></div>
                    <div className="flex gap-2"><dt className="text-slate-500">Receipts</dt><dd className="font-mono text-xs text-slate-800">{settings.receiptFolder || "— none agreed —"}</dd></div>
                    <div className="flex gap-2"><dt className="text-slate-500">Copies kept</dt><dd className="text-slate-800">{settings.keepYears} years</dd></div>
                </dl>
                <p className="mt-2 text-xs text-slate-500">{SHAPE_NOTES[shape]}</p>
                <p className="mt-1 text-xs text-slate-400">Columns: {shapeHeaders(shape).join(" · ")}</p>
            </section>

            <section className={`${card} px-4 py-3`}>
                <h2 className="text-sm font-semibold text-slate-800">Send a day by hand</h2>
                <p className="mt-1 text-xs text-slate-500">For the morning after a night it did not run. It writes exactly what the schedule would have written.</p>
                <form action={`${base}/run`} method="post" className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                    <label className="space-y-1">
                        <span className="block text-xs text-slate-500">Day</span>
                        <input type="date" name="day" defaultValue={iso(yesterday)} className="h-9 rounded-md border border-slate-300 px-2" required />
                    </label>
                    <label className="flex h-9 items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" name="force" value="1" className="h-4 w-4 rounded border-slate-300" />
                        Send again even if it already went
                    </label>
                    <button type="submit" className="h-9 rounded-md border border-slate-300 px-3 hover:bg-slate-50">Send</button>
                </form>
            </section>

            <section className={card}>
                <h2 className="border-b border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800">The last twenty</h2>
                {runs.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-slate-500">Nothing has been sent yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold">Day</th>
                                    <th className="px-2 py-2 text-left font-semibold">State</th>
                                    <th className="px-2 py-2 text-right font-semibold">Lines</th>
                                    <th className="px-2 py-2 text-left font-semibold">File</th>
                                    <th className="px-4 py-2 text-left font-semibold">Sent by</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {runs.map((run) => (
                                    <tr key={run.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-1.5 tabular-nums text-slate-800">{dateShort(iso(run.periodFrom))}</td>
                                        <td className="px-2 py-1.5">
                                            <span className={
                                                run.state === "ACKNOWLEDGED" ? "text-teal-700"
                                                    : run.state === "FAILED" ? "text-red-700"
                                                        : run.state === "PENDING" ? "text-amber-700" : "text-slate-700"
                                            }>
                                                {run.state === "ACKNOWLEDGED" ? "Confirmed"
                                                    : run.state === "DELIVERED" ? "Sent"
                                                        : run.state === "PENDING" ? "Started, never finished" : "Failed"}
                                            </span>
                                            {run.error && <span className="block text-[11px] text-slate-400">{run.error}</span>}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{run.rows ?? ""}</td>
                                        <td className="px-2 py-1.5 font-mono text-[11px] text-slate-500">{run.fileName ?? (run.rows === 0 ? "nothing to send" : "")}</td>
                                        <td className="px-4 py-1.5 text-slate-500">{run.triggeredBy === "schedule" ? "the schedule" : run.triggeredBy}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {lastGood && <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">Last file out: {lastGood.fileName ?? "a day with no trade on it"}{lastGood.checksum ? ` · sha256 ${lastGood.checksum.slice(0, 16)}…` : ""}</p>}
            </section>

            <section className={`${card} px-4 py-3`}>
                <h2 className="text-sm font-semibold text-slate-800">Everything, as one file</h2>
                <p className="mt-1 text-xs text-slate-600">
                    Every table as a CSV in one archive, with a README saying how they join. It needs nothing of ours to read, which is the point:
                    it is the answer to &ldquo;what do we have if you stop existing&rdquo;. Taking it is recorded in the transaction log like any other download.
                </p>
                <a href={`${base}/bundle`} className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                    <Download className="h-4 w-4" />Download everything
                </a>
            </section>
        </div>
    );
}
