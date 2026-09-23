import Link from "next/link";
import { Receipt, TrendingUp, Truck } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { SetupChecklist } from "@/components/setup/SetupChecklist";
import { setupSteps } from "@/lib/setup/checklist";
import { setupFacts } from "@/lib/setup/queries";
import { dashboardSummary } from "@/lib/dashboard/queries";
import { dateShort, money } from "@/lib/format";

/**
 * The first screen of the day, and it leads with work rather than takings.
 *
 * It used to open with eight tiles of totals — sold today, sold this month,
 * owed to us, owed to suppliers — which report the past accurately and tell a
 * service advisor nothing about what to do next. The queue below is the
 * inversion: every row is something waiting, phrased as the thing itself
 * ("three bookings have no mechanic"), and every row is the link to go and fix
 * it. Rows only appear when they have something to say, so an empty queue is
 * genuinely empty rather than four zeroes.
 *
 * The money figures still matter and still sit here, demoted beneath the work.
 * They are shown only to people who may see cost, and each links to the report
 * it came from, so a number that looks wrong can be chased rather than
 * distrusted.
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

    type QueueRow = {
        key: string;
        lead: string;
        text: string;
        href: string;
        tone: "plain" | "attention" | "overdue";
    };
    const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

    const queue: QueueRow[] = [];
    if (summary.unassigned > 0)
        queue.push({
            key: "unassigned",
            lead: String(summary.unassigned),
            text: plural(summary.unassigned, "booking has no mechanic", "bookings have no mechanic"),
            href: `${base}/schedule`,
            tone: "attention",
        });
    if (showMoney && summary.overdue > 0)
        queue.push({
            key: "overdue",
            lead: money_(summary.overdue),
            text: "owed to us for more than 30 days",
            href: `${base}/reports/receivables`,
            tone: "overdue",
        });
    if (summary.remindersDue > 0)
        queue.push({
            key: "reminders",
            lead: String(summary.remindersDue),
            text: plural(summary.remindersDue, "reminder to send", "reminders to send"),
            href: `${base}/reminders`,
            tone: "attention",
        });
    if (summary.openJobs > 0)
        queue.push({
            key: "jobs",
            lead: String(summary.openJobs),
            text: plural(summary.openJobs, "job card on the floor", "job cards on the floor"),
            href: `${base}/jobs`,
            tone: "plain",
        });
    if (summary.bookings > 0)
        queue.push({
            key: "bookings",
            lead: String(summary.bookings),
            text: plural(summary.bookings, "booking coming up", "bookings coming up"),
            href: `${base}/schedule`,
            tone: "plain",
        });

    const toneRule: Record<QueueRow["tone"], string> = {
        plain: "border-l-slate-200",
        attention: "border-l-amber-500",
        overdue: "border-l-red-600",
    };
    const toneLead: Record<QueueRow["tone"], string> = {
        plain: "text-slate-900",
        attention: "text-amber-700",
        overdue: "text-red-700",
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
                <p className="text-sm text-slate-500">
                    {showMoney ? "What is waiting, and how the month is going." : "What is waiting to be done."}
                </p>
            </div>

            {setup && <SetupChecklist steps={setup} />}

            <section aria-labelledby="waiting">
                <h2 id="waiting" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Waiting for someone
                </h2>
                {queue.length === 0 ? (
                    <p className="rounded-sm border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                        Nothing waiting. The floor is clear.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-100 overflow-hidden rounded-sm border border-slate-200 bg-white">
                        {queue.map((row) => (
                            <li key={row.key}>
                                <Link
                                    href={row.href}
                                    className={`flex flex-col gap-0.5 border-l-[3px] px-4 py-3 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 sm:flex-row sm:items-baseline sm:gap-3 ${toneRule[row.tone]}`}
                                >
                                    <span className={`shrink-0 whitespace-nowrap text-xl font-bold tabular-nums ${toneLead[row.tone]}`}>{row.lead}</span>
                                    <span className="text-sm text-slate-700">{row.text}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {headline.length > 0 && (
                <section aria-labelledby="takings">
                    <h2 id="takings" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Takings
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {headline.map((tile) => (
                            <Link key={tile.label} href={tile.href} className="rounded-sm border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>
                                <p className="text-2xl font-bold tabular-nums text-slate-900">{tile.value}</p>
                                <p className={`text-xs ${tile.warn ? "font-medium text-amber-700" : "text-slate-500"}`}>{tile.sub}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

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
