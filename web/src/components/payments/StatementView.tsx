import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AGEING_BUCKETS, AGEING_LABELS } from "@/lib/payments/allocation";
import type { Statement } from "@/lib/payments/queries";
import { dateShort, money } from "@/lib/format";

/**
 * A running-balance statement for one customer over a window. Receipts appear
 * as negatives against the documents, so the closing balance is arithmetic the
 * customer can follow down the page rather than a number they have to trust.
 */
export function StatementView({ tenant, statement, workshopName }: { tenant: string; statement: Statement; workshopName: string }) {
    const { customer, rows, opening, closing, ageing, unapplied, from, to } = statement;

    return (
        <div className="max-w-4xl mx-auto space-y-4 pb-16">
            <div className="flex items-center justify-between gap-4 print:hidden">
                <Link href={`/${tenant}/dashboard/customers/${customer.id}`} className="text-sm text-slate-500 hover:text-teal-700 flex items-center gap-1">
                    <ArrowLeft className="w-3.5 h-3.5" />Back to {customer.firstName} {customer.lastName}
                </Link>
                <form method="get" className="flex items-end gap-2 text-xs">
                    <label className="flex flex-col gap-1">
                        <span className="text-slate-500">From</span>
                        <input type="date" name="from" defaultValue={from} className="h-8 rounded-sm border border-slate-300 px-2 text-sm" />
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-slate-500">To</span>
                        <input type="date" name="to" defaultValue={to} className="h-8 rounded-sm border border-slate-300 px-2 text-sm" />
                    </label>
                    <button type="submit" className="h-8 rounded-sm border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50">Show</button>
                </form>
            </div>

            <section className="border border-slate-200 rounded-sm bg-white">
                <div className="flex items-start justify-between gap-6 px-6 py-5 border-b">
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Statement</h1>
                        <p className="text-xs text-slate-500">{dateShort(from)} to {dateShort(to)}</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">{customer.firstName} {customer.lastName}</p>
                        {customer.postalAddress1 && <p>{customer.postalAddress1}</p>}
                        {customer.postalCity && <p>{customer.postalCity}</p>}
                        {customer.email && <p>{customer.email}</p>}
                        <p className="mt-1 text-slate-400">{workshopName}</p>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow className="text-xs">
                            <TableHead className="pl-6 text-slate-500 font-semibold">Date</TableHead>
                            <TableHead className="text-slate-500 font-semibold">Detail</TableHead>
                            <TableHead className="text-slate-500 font-semibold">Number</TableHead>
                            <TableHead className="text-right text-slate-500 font-semibold">Amount</TableHead>
                            <TableHead className="text-right pr-6 text-slate-500 font-semibold">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="text-sm">
                            <TableCell className="pl-6 py-1.5 text-slate-500">{dateShort(from)}</TableCell>
                            <TableCell className="py-1.5 text-slate-500 italic" colSpan={2}>Balance brought forward</TableCell>
                            <TableCell className="py-1.5" />
                            <TableCell className="py-1.5 pr-6 text-right tabular-nums text-slate-600">{money(opening)}</TableCell>
                        </TableRow>
                        {rows.map((r) => (
                            <TableRow key={`${r.kind}-${r.id}`} className="text-sm">
                                <TableCell className="pl-6 py-1.5 tabular-nums text-slate-600 whitespace-nowrap">{dateShort(r.postDate)}</TableCell>
                                <TableCell className="py-1.5 text-slate-700">{r.label}{r.reference ? <span className="text-slate-400"> · {r.reference}</span> : null}</TableCell>
                                <TableCell className="py-1.5 text-slate-600">
                                    {r.kind === "DOCUMENT"
                                        ? <Link href={`/${tenant}/dashboard/documents/${r.id}`} className="hover:text-teal-700">{r.number ?? "—"}</Link>
                                        : <Link href={`/${tenant}/dashboard/payments/${r.id}`} className="hover:text-teal-700">{r.number ?? "—"}</Link>}
                                </TableCell>
                                <TableCell className={`py-1.5 text-right tabular-nums ${r.amount < 0 ? "text-teal-700" : "text-slate-700"}`}>{money(r.amount)}</TableCell>
                                <TableCell className="py-1.5 pr-6 text-right tabular-nums font-medium text-slate-700">{money(r.balance)}</TableCell>
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">Nothing on this account in that period.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>

                <div className="border-t bg-slate-50 px-6 py-4 flex flex-wrap items-end justify-between gap-6">
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-1 text-xs">
                        {AGEING_BUCKETS.map((bucket) => (
                            <div key={bucket}>
                                <dt className="text-[10px] uppercase tracking-wider text-slate-400">{AGEING_LABELS[bucket]}</dt>
                                <dd className={`tabular-nums font-medium ${bucket === "d90" && ageing[bucket] > 0 ? "text-red-700" : "text-slate-700"}`}>{money(ageing[bucket])}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="text-right">
                        {unapplied > 0 && <p className="text-xs text-amber-700">Includes {money(unapplied)} already paid and not yet applied.</p>}
                        <p className="text-sm text-slate-500">Closing balance</p>
                        <p className="text-xl font-bold tabular-nums text-slate-800">{money(closing)}</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
