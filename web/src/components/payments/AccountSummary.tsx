import Link from "next/link";
import { FileText, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPayment, createRefund } from "@/lib/payments/actions";
import { AGEING_BUCKETS, AGEING_LABELS, refundable } from "@/lib/payments/allocation";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import type { CustomerAccount } from "@/lib/payments/queries";
import { dateShort, money } from "@/lib/format";

/**
 * What this customer owes, broken into the columns a statement uses.
 *
 * Unapplied credit is shown next to the balance rather than netted into it:
 * the benchmark leaves it buried, and "you owe N$4,000 but N$1,200 of yours is
 * already sitting here" is the conversation the counter actually has.
 */
export function AccountSummary({ tenant, customerId, account, canTakePayment }: { tenant: string; customerId: string; account: CustomerAccount; canTakePayment: boolean }) {
    const base = `/${tenant}/dashboard`;
    const { ageing, unapplied, netOwing, openItems } = account;
    const owedBack = refundable(openItems, unapplied);

    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Account</h2>
                <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="h-7">
                        <Link href={`${base}/customers/${customerId}/statement`}><FileText className="w-3.5 h-3.5 mr-1" />Statement</Link>
                    </Button>
                    {canTakePayment && owedBack > 0 && (
                        <form action={createRefund.bind(null, tenant, { customerId })}>
                            <Button type="submit" size="sm" variant="outline" className="h-7" title={`${money(owedBack)} can be handed back`}>
                                <Minus className="w-3.5 h-3.5 mr-1" />Refund
                            </Button>
                        </form>
                    )}
                    {canTakePayment && (
                        <form action={createPayment.bind(null, tenant, { customerId })}>
                            <Button type="submit" size="sm" className="h-7 bg-teal-600 hover:bg-teal-700"><Plus className="w-3.5 h-3.5 mr-1" />Take payment</Button>
                        </form>
                    )}
                </div>
            </div>

            <dl className="grid grid-cols-2 md:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-b border-slate-100">
                {AGEING_BUCKETS.map((bucket) => (
                    <div key={bucket} className="px-4 py-3">
                        <dt className="text-[10px] uppercase tracking-wider text-slate-400">{AGEING_LABELS[bucket]}</dt>
                        <dd className={`text-sm tabular-nums font-medium ${bucket === "d90" && ageing[bucket] > 0 ? "text-red-700" : "text-slate-700"}`}>{money(ageing[bucket])}</dd>
                    </div>
                ))}
                <div className="px-4 py-3">
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400">Unapplied credit</dt>
                    <dd className={`text-sm tabular-nums font-medium ${unapplied > 0 ? "text-amber-700" : "text-slate-400"}`}>{money(unapplied)}</dd>
                </div>
                <div className="px-4 py-3 bg-slate-50">
                    <dt className="text-[10px] uppercase tracking-wider text-slate-400">Net owing</dt>
                    <dd className="text-sm tabular-nums font-bold text-slate-800">{money(netOwing)}</dd>
                </div>
            </dl>

            {openItems.length === 0 ? (
                <p className="px-4 py-4 text-sm text-slate-500">Nothing outstanding.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow className="text-xs">
                            <TableHead className="pl-4 text-slate-500 font-semibold">Date</TableHead>
                            <TableHead className="text-slate-500 font-semibold">Number</TableHead>
                            <TableHead className="text-slate-500 font-semibold">Type</TableHead>
                            <TableHead className="text-slate-500 font-semibold">Due</TableHead>
                            <TableHead className="text-right text-slate-500 font-semibold">Total</TableHead>
                            <TableHead className="text-right pr-4 text-slate-500 font-semibold">Outstanding</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {openItems.map((item) => (
                            <TableRow key={item.id} className="text-sm">
                                <TableCell className="pl-4 py-1.5 tabular-nums text-slate-600 whitespace-nowrap">{dateShort(item.postDate)}</TableCell>
                                <TableCell className="py-1.5 font-medium">
                                    <Link href={`${base}/documents/${item.id}`} className="text-slate-700 hover:text-teal-700">{item.number ?? "—"}</Link>
                                </TableCell>
                                <TableCell className="py-1.5 text-slate-600 whitespace-nowrap">{DOCUMENT_TYPE_LABELS[item.type]}</TableCell>
                                <TableCell className="py-1.5 tabular-nums text-slate-500 whitespace-nowrap">{item.dueDate ? dateShort(item.dueDate) : ""}</TableCell>
                                <TableCell className="py-1.5 text-right tabular-nums text-slate-500">{money(item.total)}</TableCell>
                                <TableCell className={`py-1.5 pr-4 text-right tabular-nums font-medium ${item.outstanding < 0 ? "text-teal-700" : "text-slate-700"}`}>{money(item.outstanding)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </section>
    );
}
