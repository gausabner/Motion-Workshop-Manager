import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText, LineChart } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { startOfMonth, toZoned, addDays } from "@/lib/diary/time";
import { BUSINESS_TITLES, type BusinessReport } from "@/lib/exports/business";

export const metadata = { title: "For the owner | MOTION Workshop Manager" };

/**
 * The reports an owner opens to decide something, as against the ones they
 * open because an auditor is coming.
 *
 * Grouped by the question being asked rather than by where the data lives,
 * because "what made money" and "what is not moving" are how somebody thinks
 * at month end, and "documents" and "products" are not.
 */

const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

function endOfMonth(date: string): string {
    const [y, m] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

type Card = { name: BusinessReport; blurb: string; asAt?: boolean; show: boolean };

export default async function BusinessReportsPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view")) notFound();

    const money = can(membership, "documents:see_cost");
    const stock = money && can(membership, "products:write");

    const today = toZoned(new Date(), tenant.timezone).day;
    const lastMonthEnd = addDays(startOfMonth(today), -1);
    const from = valid(sp.from) ?? startOfMonth(lastMonthEnd);
    const to = valid(sp.to) ?? endOfMonth(from);

    const base = `/${slug}/dashboard/reports/business`;
    const link = (report: string, format: "csv" | "pdf") => `${base}/download?report=${report}&from=${from}&to=${to}&format=${format}`;

    const groups: { heading: string; blurb: string; cards: Card[] }[] = [
        {
            heading: "What made money",
            blurb: "For the period above.",
            cards: [
                { name: "profit", blurb: "Every job ranked by what it made, with the ones that cost more than they brought in at the bottom.", show: money },
                { name: "items", blurb: "The same sales cut four ways — by product, by group, by supplier, and by parts against labour.", show: money },
                { name: "quotes", blurb: "How many quotes turned into work, how many did not, and what the difference is worth.", show: money },
                { name: "labour", blurb: "Hours clocked against hours charged, per mechanic, with time on unfinished jobs held back.", show: true },
            ],
        },
        {
            heading: "What is standing still",
            blurb: "As things are today.",
            cards: [
                { name: "wip", blurb: "Jobs opened and not yet invoiced — work done and not yet billed.", asAt: true, show: money },
                { name: "creditors", blurb: "Supplier invoices still to pay, aged, with every unpaid invoice under each supplier.", asAt: true, show: stock },
                { name: "stock", blurb: "What is on the shelves and what it cost, with the negatives and the nil-cost lines flagged.", asAt: true, show: stock },
            ],
        },
        {
            heading: "The book",
            blurb: "Everyone and everything on file.",
            cards: [
                { name: "renewals", blurb: "Services, licence discs and roadworthies falling due in the period, soonest first, with numbers to ring.", show: true },
                { name: "customers", blurb: "Every customer, with what they have been invoiced and when they were last in.", asAt: true, show: true },
                { name: "vehicles", blurb: "Every vehicle, by plate, with the dates that decide when it should next come in.", asAt: true, show: true },
            ],
        },
    ];

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link href={`/${slug}/dashboard/reports`} className="text-xs font-medium text-teal-700 hover:underline">← Reports</Link>
                    <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><LineChart className="h-6 w-6 text-slate-400" />For the owner</h1>
                    <p className="text-sm text-slate-500">The CSV is the one to take: these are for sorting, not for filing. The PDF is there when somebody wants it on paper.</p>
                </div>
                <form action={base} method="get" className="flex items-end gap-2 text-sm">
                    <label className="space-y-1"><span className="block text-xs text-slate-500">From</span><input type="date" name="from" defaultValue={from} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                    <label className="space-y-1"><span className="block text-xs text-slate-500">To</span><input type="date" name="to" defaultValue={to} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                    <button type="submit" className="h-9 rounded-md border border-slate-300 px-3 hover:bg-slate-50">Show</button>
                </form>
            </div>

            {groups.map((group) => {
                const cards = group.cards.filter((c) => c.show);
                if (cards.length === 0) return null;
                return (
                    <section key={group.heading} className="space-y-2">
                        <h2 className="text-sm font-semibold text-slate-700">
                            {group.heading} <span className="font-normal text-slate-400">· {group.blurb}</span>
                        </h2>
                        <ul className="space-y-2">
                            {cards.map((card) => (
                                <li key={card.name} className="rounded-sm border border-slate-200 bg-white px-4 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium text-slate-800">{BUSINESS_TITLES[card.name]}</span>
                                            <span className="block text-xs text-slate-500">{card.blurb}</span>
                                        </span>
                                        <span className="flex gap-2">
                                            <a href={link(card.name, "csv")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><Download className="h-4 w-4" />CSV</a>
                                            <a href={link(card.name, "pdf")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><FileText className="h-4 w-4" />PDF</a>
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}

            <p className="rounded-sm border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                Work in progress, creditors, stock, and the two listings are a picture of today rather than of the period — MOTION does not keep a stock level as at a past date, and inventing one from today&rsquo;s figure would be the most confident kind of wrong. Everything else uses the dates above. Every file says who produced it and when, and every download is written to the audit trail.
            </p>
        </div>
    );
}
