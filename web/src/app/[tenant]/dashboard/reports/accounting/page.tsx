import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { exportCounts } from "@/lib/accounting/queries";
import { accountingSettings } from "@/lib/settings/schema";
import { startOfMonth, toZoned, addDays } from "@/lib/diary/time";
import { dateShort, money } from "@/lib/format";

export const metadata = { title: "For the bookkeeper | MOTION Workshop Manager" };

const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

/** The last day of the month a date falls in. */
function endOfMonth(date: string): string {
    const [y, m] = date.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export default async function AccountingPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view") || !can(membership, "documents:see_cost")) notFound();

    const today = toZoned(new Date(), tenant.timezone).day;
    const lastMonthEnd = addDays(startOfMonth(today), -1);
    const from = valid(sp.from) ?? startOfMonth(lastMonthEnd);
    const to = valid(sp.to) ?? endOfMonth(from);
    const counts = await exportCounts(db, day(from), day(to));
    const accounts = accountingSettings(tenant.settings);
    const base = `/${slug}/dashboard/reports/accounting`;
    const download = (kind: string, format = "plain") => `${base}/download?from=${from}&to=${to}&kind=${kind}&format=${format}`;

    const sets = [
        { kind: "sales", title: "Sales", blurb: "Invoices, cash sales and credit notes, with the tax shown apart.", count: counts.sales.count, total: counts.sales.total, formats: true },
        { kind: "receipts", title: "Money in", blurb: "Receipts and refunds, with how each was paid.", count: counts.receipts.count, total: counts.receipts.total, formats: false },
        { kind: "purchases", title: "Purchases", blurb: "Supplier invoices received in the period.", count: counts.purchases.count, total: counts.purchases.total, formats: false },
        { kind: "supplierPayments", title: "Money out", blurb: "What was paid to suppliers, and against which accounts.", count: counts.supplierPayments.count, total: counts.supplierPayments.total, formats: false },
    ];

    return (
        <div className="mx-auto w-full max-w-4xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Link href={`/${slug}/dashboard/reports`} className="text-xs font-medium text-teal-700 hover:underline">← Reports</Link>
                    <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><FileSpreadsheet className="h-6 w-6 text-slate-400" />For the bookkeeper</h1>
                    <p className="text-sm text-slate-500">A month at a time, as CSV. Nothing is sent anywhere — the file downloads to this machine for you to pass on.</p>
                </div>
                <form action={base} method="get" className="flex items-end gap-2 text-sm">
                    <label className="space-y-1"><span className="block text-xs text-slate-500">From</span><input type="date" name="from" defaultValue={from} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                    <label className="space-y-1"><span className="block text-xs text-slate-500">To</span><input type="date" name="to" defaultValue={to} className="h-9 rounded-md border border-slate-300 px-2" /></label>
                    <button type="submit" className="h-9 rounded-md border border-slate-300 px-3 hover:bg-slate-50">Show</button>
                </form>
            </div>

            <p className="text-sm text-slate-500">{dateShort(from)} to {dateShort(to)}</p>

            <ul className="space-y-3">
                {sets.map((set) => (
                    <li key={set.kind} className="rounded-sm border border-slate-200 bg-white px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="min-w-0">
                                <span className="block font-medium text-slate-800">{set.title}</span>
                                <span className="block text-xs text-slate-500">{set.blurb}</span>
                            </span>
                            <span className="text-right">
                                <span className="block text-sm font-semibold tabular-nums text-slate-800">{money(set.total, tenant.currency)}</span>
                                <span className="block text-xs text-slate-500">{set.count} document{set.count === 1 ? "" : "s"}</span>
                            </span>
                            <span className="flex flex-wrap gap-2">
                                <a href={download(set.kind)} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"><Download className="h-4 w-4" />CSV</a>
                                {set.formats && (
                                    <>
                                        <a href={download(set.kind, "xero")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Xero</a>
                                        <a href={download(set.kind, "journal")} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Journal</a>
                                    </>
                                )}
                            </span>
                        </div>
                    </li>
                ))}
            </ul>

            <p className="rounded-sm border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                The journal posts debtors {accounts.debtors}, sales {accounts.sales} and tax {accounts.tax}; the Xero file uses account {accounts.salesAccount} and tax type &ldquo;{accounts.salesTaxType}&rdquo;.
                Internal jobs are included here, because the bookkeeper still has to see them — they are only kept out of the profit figures.
            </p>
        </div>
    );
}
