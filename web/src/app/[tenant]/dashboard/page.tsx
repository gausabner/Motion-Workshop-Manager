import Link from "next/link";
import { Bell, CalendarDays, ClipboardList, Package, Receipt, TrendingUp, Truck, Users } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { SetupChecklist } from "@/components/setup/SetupChecklist";
import { setupSteps } from "@/lib/setup/checklist";
import { setupFacts } from "@/lib/setup/queries";
import { dashboardSummary } from "@/lib/dashboard/queries";
import { dateShort, money } from "@/lib/format";

/**
 * The first screen of the day. The money figures are only shown to people who
 * may see cost, and each one links to the report it came from, so a number
 * that looks wrong can be chased rather than distrusted.
 */
export default async function DashboardPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { tenant, db, membership } = await requireTenant(slug);
    const showMoney = can(membership, "documents:see_cost");
    const [summary, facts] = await Promise.all([
        dashboardSummary(db, tenant),
        can(membership, "settings:manage") ? setupFacts(db, tenant) : null,
    ]);
    const setup = facts ? setupSteps(facts, `/${slug}`) : null;
    const base = `/${slug}/dashboard`;
    const currency = tenant.currency;

    const money_ = (value: number) => money(value, currency);
    const headline = showMoney
        ? [
            { label: "Sold today", value: money_(summary.today.sales), sub: summary.today.profit !== 0 ? `${money_(summary.today.profit)} profit` : "Nothing yet today", href: `${base}/reports/margin` },
            { label: `This month, from ${dateShort(summary.month.from)}`, value: money_(summary.month.sales), sub: `${money_(summary.month.profit)} profit${summary.month.percent === null ? "" : ` · ${summary.month.percent}%`}`, href: `${base}/reports/margin` },
            { label: "Owed to us", value: money_(summary.owedToUs), sub: summary.overdue > 0 ? `${money_(summary.overdue)} over 30 days` : "Nothing overdue", href: `${base}/reports/receivables`, warn: summary.overdue > 0 },
            { label: "We owe suppliers", value: money_(summary.owedBySupplier), sub: summary.owedBySupplier > 0 ? "See what we owe" : "Nothing outstanding", href: `${base}/reports/payables` },
        ]
        : [];

    const work = [
        { label: "Jobs on the floor", value: summary.openJobs, icon: ClipboardList, href: `${base}/jobs` },
        { label: "Bookings coming up", value: summary.bookings, icon: CalendarDays, href: `${base}/schedule`, sub: summary.unassigned > 0 ? `${summary.unassigned} with no mechanic` : undefined },
        { label: "Reminders to send", value: summary.remindersDue, icon: Bell, href: `${base}/reminders` },
        showMoney
            ? { label: "Stock at cost", value: money_(summary.stockValue), icon: Package, href: `${base}/products` }
            : { label: "Customers", value: "", icon: Users, href: `${base}/customers` },
    ];

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
                <p className="text-sm text-slate-500">
                    {showMoney ? "Today and this month, and what is waiting to be done." : "What is waiting to be done."}
                </p>
            </div>

            {setup && <SetupChecklist steps={setup} />}

            {headline.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {headline.map((tile) => (
                        <Link key={tile.label} href={tile.href} className="rounded-sm border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>
                            <p className="text-2xl font-bold tabular-nums text-slate-900">{tile.value}</p>
                            <p className={`text-xs ${tile.warn ? "font-medium text-amber-700" : "text-slate-500"}`}>{tile.sub}</p>
                        </Link>
                    ))}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {work.map((tile) => (
                    <Link key={tile.label} href={tile.href} className="flex items-center gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md">
                        <tile.icon className="h-5 w-5 shrink-0 text-slate-400" />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-700">{tile.label}</span>
                            <span className="block text-xl font-bold tabular-nums text-slate-900">{tile.value}</span>
                            {"sub" in tile && tile.sub && <span className="block text-xs text-amber-700">{tile.sub}</span>}
                        </span>
                    </Link>
                ))}
            </div>

            {showMoney && (
                <div className="flex flex-wrap gap-3 text-sm">
                    <Link href={`${base}/reports/margin`} className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"><TrendingUp className="h-4 w-4 text-slate-400" />Profit</Link>
                    <Link href={`${base}/reports/receivables`} className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"><Receipt className="h-4 w-4 text-slate-400" />Who owes us</Link>
                    <Link href={`${base}/purchasing`} className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"><Truck className="h-4 w-4 text-slate-400" />Buying</Link>
                    <Link href={`${base}/reports`} className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50">All reports</Link>
                </div>
            )}
        </div>
    );
}
