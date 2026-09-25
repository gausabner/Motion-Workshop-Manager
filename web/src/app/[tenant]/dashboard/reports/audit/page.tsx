import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileText, ShieldCheck } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { startOfMonth, toZoned, addDays } from "@/lib/diary/time";
import { countAudit } from "@/lib/audit/period";
import { sequenceAudit, unexplained } from "@/lib/documents/gaps";
import { REPORT_TITLES } from "@/lib/exports/registers";
import { dateShort } from "@/lib/format";

export const metadata = { title: "For the auditor | MOTION Workshop Manager" };

/**
 * The page a workshop opens the week an auditor is coming.
 *
 * It leads with the one figure that decides how that visit goes — whether any
 * document number in the period is unaccounted for — because that is the first
 * thing asked and the only one that cannot be answered on the spot by looking
 * something up. Everything else on the page is a file to hand over.
 */

const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const day = (s: string) => new Date(`${s}T00:00:00Z`);
const endOf = (s: string) => new Date(`${s}T23:59:59.999Z`);

function endOfMonth(date: string): string {
    const [y, m] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export default async function AuditPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view") || !can(membership, "documents:see_cost")) notFound();

    const today = toZoned(new Date(), tenant.timezone).day;
    const lastMonthEnd = addDays(startOfMonth(today), -1);
    const from = valid(sp.from) ?? startOfMonth(lastMonthEnd);
    const to = valid(sp.to) ?? endOfMonth(from);

    const [events, sequences] = await Promise.all([
        countAudit(db, { from: day(from), to: endOf(to) }),
        sequenceAudit(db, day(from), endOf(to)),
    ]);
    const holes = unexplained(sequences);
    const issued = sequences.reduce((total, s) => total + s.issued, 0);

    const base = `/${slug}/dashboard/reports/audit`;
    const link = (report: string, format: "csv" | "pdf") => `${base}/download?report=${report}&from=${from}&to=${to}&format=${format}`;

    const reports = [
        { name: "sequence", blurb: "Every number issued in the period, the gaps, and what accounts for each one. The completeness test." },
        { name: "sales", blurb: "One line per invoice, cash sale and credit note, with the tax apart and the period totalled." },
        { name: "vat", blurb: "Output tax on sales against input tax on purchases, by the rate that was actually charged." },
        { name: "cashbook", blurb: "Money in and money out, grouped by how it moved, so cash reconciles separately from card and EFT." },
        { name: "debtors", blurb: "What is owed as at the end of the period, aged from the due date." },
        { name: "transactions", blurb: `Everything anybody did in the period — ${events.toLocaleString("en-GB")} event${events === 1 ? "" : "s"} — with who did it and what changed.` },
    ];

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link href={`/${slug}/dashboard/reports`} className="text-xs font-medium text-teal-700 hover:underline">← Reports</Link>
                    <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><ShieldCheck className="h-6 w-6 text-slate-400" />For the auditor</h1>
                    <p className="text-sm text-slate-500">A period at a time. The PDF is the one that gets filed; the CSV is the one that gets re-added.</p>
                </div>
                <form action={base} method="get" className="flex items-end gap-2 text-sm">
                    <label className="space-y-1"><span className="block text-xs text-slate-500">From</span><input type="date" name="from" defaultValue={from} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                    <label className="space-y-1"><span className="block text-xs text-slate-500">To</span><input type="date" name="to" defaultValue={to} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                    <button type="submit" className="h-9 rounded-md border border-slate-300 px-3 hover:bg-slate-50">Show</button>
                </form>
            </div>

            <section className={`flex items-start gap-3 rounded-sm border px-4 py-3 ${holes === 0 ? "border-teal-200 bg-teal-50" : "border-amber-300 bg-amber-50"}`}>
                {holes === 0
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" aria-hidden="true" />
                    : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />}
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                        {holes === 0
                            ? `Every number is accounted for — ${issued.toLocaleString("en-GB")} issued between ${dateShort(from)} and ${dateShort(to)}.`
                            : `${holes} number${holes === 1 ? "" : "s"} in this period cannot be accounted for.`}
                    </p>
                    <p className="text-xs text-slate-600">
                        {holes === 0
                            ? "A voided document keeps its number and is not a gap. Nothing was quietly removed."
                            : "This does not stop anything, and it is usually a draft somebody tidied away. It is worth knowing before somebody else finds it — the sequence report below lists each one."}
                    </p>
                </div>
            </section>

            <ul className="space-y-3">
                {reports.map((report) => (
                    <li key={report.name} className="rounded-sm border border-slate-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="min-w-0 flex-1">
                                <span className="block font-medium text-slate-800">{REPORT_TITLES[report.name as keyof typeof REPORT_TITLES]}</span>
                                <span className="block text-xs text-slate-500">{report.blurb}</span>
                            </span>
                            <span className="flex gap-2">
                                <a href={link(report.name, "pdf")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><FileText className="h-4 w-4" />PDF</a>
                                <a href={link(report.name, "csv")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><Download className="h-4 w-4" />CSV</a>
                            </span>
                        </div>
                    </li>
                ))}
            </ul>

            <p className="rounded-sm border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                Every file says on it who produced it, when, over what period, and how many rows it should hold — and every download is written to the audit trail, so the transaction log shows who has been taking data out as well as who has been changing it.
            </p>
        </div>
    );
}
