import Link from "next/link";
import { Archive, FileSpreadsheet, LineChart, Receipt, Share2, ShieldCheck, Timer, TrendingUp, Wallet } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { includes } from "@/lib/plans/features";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { dashboardSummary } from "@/lib/dashboard/queries";
import { money } from "@/lib/format";
import { TERM, tabTitle } from "@/lib/copy/terms";

export const metadata = { title: tabTitle("Reports") };

export default async function ReportsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership, plan } = await requireTenant(slug);
    if (!can(membership, "reports:view"))
        return <AccessDenied tenant={slug} group={membership.group} needs="see reports" />;
    const showMoney = can(membership, "documents:see_cost");
    const summary = showMoney ? await dashboardSummary(db, tenant) : null;
    const base = `/${slug}/dashboard/reports`;

    const reports = [
        {
            href: `${base}/margin`, icon: TrendingUp, title: "Profit",
            blurb: "Sales less the cost of parts and labour, by product, with every job ranked by profit.",
            figure: summary ? `${money(summary.month.profit, tenant.currency)} this month` : null,
            show: showMoney,
        },
        {
            href: `${base}/receivables`, icon: Receipt, title: TERM.debtors,
            blurb: "Customers with money outstanding, aged, including amounts over 30 days.",
            figure: summary ? `${money(summary.owedToUs, tenant.currency)} outstanding` : null,
            show: true,
        },
        {
            href: `${base}/payables`, icon: Wallet, title: TERM.creditors,
            blurb: "Supplier invoices still to be paid, aged by supplier.",
            figure: summary ? `${money(summary.owedBySupplier, tenant.currency)} outstanding` : null,
            show: showMoney && can(membership, "products:write") && includes(plan, "purchasing"),
        },
        {
            href: `${base}/audit`, icon: ShieldCheck, title: TERM.auditReports,
            blurb: "The six reports a council audit requires: the number sequence and any gaps, the sales register, VAT, the cash book, debtors and the activity log.",
            figure: null,
            show: showMoney && includes(plan, "auditPack"),
        },
        {
            href: `${base}/business`, icon: LineChart, title: TERM.managementReports,
            blurb: "Profit by job, item sales, work in progress, quote outcomes, stock, creditors and renewals, as files you can sort.",
            figure: null,
            show: includes(plan, "ownerReports"),
        },
        {
            href: `${base}/accounting`, icon: FileSpreadsheet, title: TERM.accountingExport,
            blurb: "Sales, receipts, purchases and payments for a month, as CSV: plain, Xero or a journal.",
            figure: null,
            show: showMoney,
        },
        {
            href: `${base}/handoff`, icon: Share2, title: TERM.accountingIntegration,
            blurb: "The nightly journal to your accounting system: whether last night's was sent and collected, and a full archive of your data.",
            figure: null,
            show: can(membership, "settings:manage") && includes(plan, "handoff"),
        },
        {
            // Every plan's promise: your data is yours, every table, any time.
            // Its own card, so it does not depend on the integration it lives beside.
            href: `${base}/handoff/bundle`, icon: Archive, title: "Full data export",
            blurb: "Every table as CSV in one archive, with a README explaining how they relate. Available at any time.",
            figure: null,
            show: can(membership, "settings:manage") && !includes(plan, "handoff"),
        },
        {
            href: `${base}/labour`, icon: Timer, title: "Mechanic time",
            blurb: "Hours clocked against hours charged, by mechanic and by job.",
            figure: null,
            show: true,
        },
    ].filter((r) => r.show);

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                <p className="text-sm text-slate-500">Every figure is calculated from the documents when you open the report; nothing is stored.</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
                {reports.map((report) => (
                    <li key={report.href}>
                        <Link href={report.href} className="flex h-full gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md">
                            <report.icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                            <span>
                                <span className="block font-medium text-slate-800">{report.title}</span>
                                <span className="block text-xs text-slate-500">{report.blurb}</span>
                                {report.figure && <span className="mt-1 block text-sm font-semibold tabular-nums text-slate-700">{report.figure}</span>}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
