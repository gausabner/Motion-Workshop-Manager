import Link from "next/link";
import { FileSpreadsheet, Receipt, Timer, TrendingUp, Wallet } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { dashboardSummary } from "@/lib/dashboard/queries";
import { money } from "@/lib/format";

export const metadata = { title: "Reports | MOTION Workshop Manager" };

export default async function ReportsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view"))
        return <AccessDenied tenant={slug} group={membership.group} needs="see reports" />;
    const showMoney = can(membership, "documents:see_cost");
    const summary = showMoney ? await dashboardSummary(db, tenant) : null;
    const base = `/${slug}/dashboard/reports`;

    const reports = [
        {
            href: `${base}/margin`, icon: TrendingUp, title: "Profit",
            blurb: "Sales less what the work cost, by parts and labour, by product, and every job ranked by what it made.",
            figure: summary ? `${money(summary.month.profit, tenant.currency)} this month` : null,
            show: showMoney,
        },
        {
            href: `${base}/receivables`, icon: Receipt, title: "Who owes us",
            blurb: "Customers with money outstanding, aged, with what is over 30 days.",
            figure: summary ? `${money(summary.owedToUs, tenant.currency)} owed` : null,
            show: true,
        },
        {
            href: `${base}/payables`, icon: Wallet, title: "What we owe",
            blurb: "Supplier invoices still to pay, aged by supplier.",
            figure: summary ? `${money(summary.owedBySupplier, tenant.currency)} owed` : null,
            show: showMoney && can(membership, "products:write"),
        },
        {
            href: `${base}/accounting`, icon: FileSpreadsheet, title: "For the bookkeeper",
            blurb: "Sales, receipts, purchases and payments for a month, as CSV — plain, Xero or a journal.",
            figure: null,
            show: showMoney,
        },
        {
            href: `${base}/labour`, icon: Timer, title: "Mechanic time",
            blurb: "Hours clocked against hours charged, per mechanic and per job.",
            figure: null,
            show: true,
        },
    ].filter((r) => r.show);

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                <p className="text-sm text-slate-500">Every figure is worked out from the documents themselves when you open it — nothing is stored and left to go stale.</p>
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
