import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { marginReport, type MarginRow } from "@/lib/stock/reports";
import { startOfMonth, toZoned } from "@/lib/diary/time";
import { money } from "@/lib/format";
import { DownloadPair } from "@/components/exports/DownloadPair";

export const metadata = { title: "Profit | MOTION Workshop Manager" };

const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

function Head() {
    return (
        <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
                <th className="px-4 py-2 text-left font-semibold">What</th>
                <th className="px-2 py-2 text-right font-semibold">Qty</th>
                <th className="px-2 py-2 text-right font-semibold">Sales</th>
                <th className="px-2 py-2 text-right font-semibold">Cost</th>
                <th className="px-4 py-2 text-right font-semibold">Profit</th>
            </tr>
        </thead>
    );
}

function Rows({ rows, currency, href }: { rows: MarginRow[]; currency: string; href?: (row: MarginRow) => string }) {
    return (
        <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-slate-500">Nothing in this period.</td></tr>}
            {rows.map((r) => (
                <tr key={r.key} className="hover:bg-slate-50">
                    <td className="px-4 py-1.5">
                        {href ? <Link href={href(r)} className="font-medium text-slate-800 hover:text-teal-700">{r.label}</Link> : <span className="font-medium text-slate-800">{r.label}</span>}
                        {r.sub && <span className="block text-[11px] text-slate-400">{r.sub}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{r.quantity}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{money(r.margin.sales, currency)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{money(r.margin.cost, currency)}</td>
                    <td className={`px-4 py-1.5 text-right font-semibold tabular-nums ${r.margin.profit < 0 ? "text-red-700" : "text-slate-800"}`}>
                        {money(r.margin.profit, currency)}
                        <span className="ml-1 text-[11px] font-normal text-slate-400">{r.margin.percent === null ? "" : `${r.margin.percent}%`}</span>
                    </td>
                </tr>
            ))}
        </tbody>
    );
}

export default async function MarginReportPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view") || !can(membership, "documents:see_cost")) notFound();

    const today = toZoned(new Date(), tenant.timezone).day;
    const from = valid(sp.from) ?? startOfMonth(today);
    const to = valid(sp.to) ?? today;
    const report = await marginReport(db, tenant, day(from), day(to));
    const base = `/${slug}/dashboard/reports/margin`;
    const card = "rounded-sm border border-slate-200 bg-white";

    return (
        <div className="mx-auto w-full max-w-6xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><TrendingUp className="h-6 w-6 text-slate-400" />Profit</h1>
                    <p className="text-sm text-slate-500">Sales less what the work cost, excluding tax. Credit notes come off both sides.</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <form action={base} method="get" className="flex items-end gap-2 text-sm">
                        <label className="space-y-1"><span className="block text-xs text-slate-500">From</span><input type="date" name="from" defaultValue={from} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                        <label className="space-y-1"><span className="block text-xs text-slate-500">To</span><input type="date" name="to" defaultValue={to} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                        <button type="submit" className="h-9 rounded-md border border-slate-300 px-3 hover:bg-slate-50">Show</button>
                    </form>
                    <DownloadPair tenant={slug} report="profit" params={{ from, to }} />
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
                {[
                    { label: "Sales", value: money(report.totals.sales, tenant.currency), tone: "text-slate-900" },
                    { label: "Cost", value: money(report.totals.cost, tenant.currency), tone: "text-slate-600" },
                    { label: "Profit", value: money(report.totals.profit, tenant.currency), tone: report.totals.profit < 0 ? "text-red-700" : "text-teal-700" },
                    { label: "Margin", value: report.totals.percent === null ? "—" : `${report.totals.percent}%`, tone: "text-slate-900" },
                ].map((tile) => (
                    <div key={tile.label} className={`${card} px-4 py-3`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>
                        <p className={`text-2xl font-bold tabular-nums ${tile.tone}`}>{tile.value}</p>
                    </div>
                ))}
            </div>

            {report.missingCost > 0 && (
                <p className="flex items-start gap-2 rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {report.missingCost} part {report.missingCost === 1 ? "line was" : "lines were"} sold with no cost recorded, so the profit above is flattered. Put a cost on those products.
                </p>
            )}

            <section className={card}>
                <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Parts, labour and the rest</h2>
                <table className="w-full text-sm"><Head /><Rows rows={report.byType} currency={tenant.currency} /></table>
            </section>

            <section className={card}>
                <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What earned most</h2>
                <table className="w-full text-sm"><Head /><Rows rows={report.topProducts} currency={tenant.currency} /></table>
            </section>

            {report.worstProducts.length > 0 && (
                <section className={card}>
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sold at a loss, or close to it</h2>
                    <table className="w-full text-sm"><Head /><Rows rows={report.worstProducts} currency={tenant.currency} /></table>
                    <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Under 10% margin, or below cost. Usually a stale cost price, or a discount that went too far.</p>
                </section>
            )}

            <section className={card}>
                <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Every job, by profit</h2>
                <table className="w-full text-sm"><Head /><Rows rows={report.jobs} currency={tenant.currency} href={(r) => `/${slug}/dashboard/documents/${r.key}`} /></table>
            </section>
        </div>
    );
}
