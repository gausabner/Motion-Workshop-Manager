import Link from "next/link";
import { FileText, MessageCircle, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { listReceivables } from "@/lib/payments/queries";
import { AGEING_BUCKETS, AGEING_LABELS } from "@/lib/payments/allocation";
import { businessToday } from "@/lib/tenant/today";
import { dateShort, money, whatsappLink } from "@/lib/format";

export const metadata = { title: "Who owes us | MOTION Workshop Manager" };

export default async function ReceivablesPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view"))
        return <AccessDenied tenant={slug} group={membership.group} needs="see reports" />;

    const asAt = businessToday(tenant.timezone);
    const { rows, totals, unapplied } = await listReceivables(db, asAt);
    const base = `/${slug}/dashboard`;

    return (
        <div className="w-full max-w-7xl mx-auto">
            <Card className="rounded-none shadow-none border border-slate-200">
                <CardHeader className="bg-slate-200 border-b py-2 px-4 flex flex-row items-center justify-between space-y-0 h-14">
                    <div className="flex items-center gap-3">
                        <Wallet className="w-5 h-5 text-slate-600" />
                        <CardTitle className="text-lg text-slate-800 font-bold">Who owes us</CardTitle>
                    </div>
                    <span className="text-xs text-slate-600">As at {dateShort(asAt)}</span>
                </CardHeader>

                <CardContent className="p-0 bg-white">
                    <div className="overflow-x-auto">
                        <Table data-mobile="cards">
                            <TableHeader>
                                <TableRow className="bg-white hover:bg-white text-xs border-b border-slate-200">
                                    <TableHead className="pl-4 text-slate-500 font-semibold">Customer</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Oldest due</TableHead>
                                    {AGEING_BUCKETS.map((bucket) => (
                                        <TableHead key={bucket} className="text-right text-slate-500 font-semibold">{AGEING_LABELS[bucket]}</TableHead>
                                    ))}
                                    <TableHead className="text-right text-slate-500 font-semibold">Owing</TableHead>
                                    <TableHead className="pr-4 text-right text-slate-500 font-semibold">Chase</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 && (
                                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">Nobody owes anything. Every invoice on the books is settled.</TableCell></TableRow>
                                )}
                                {rows.map((r, i) => {
                                    const wa = whatsappLink(r.mobile);
                                    return (
                                        <TableRow key={r.customerId} className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none text-sm`}>
                                            <TableCell data-mobile="primary" className="pl-4 py-2 font-medium">
                                                <Link href={`${base}/customers/${r.customerId}`} className="text-slate-700 hover:text-teal-700">{r.name}</Link>
                                            </TableCell>
                                            <TableCell data-label="Oldest due" className="py-2 tabular-nums text-slate-500 whitespace-nowrap">{r.oldestDue ? dateShort(r.oldestDue) : ""}</TableCell>
                                            {AGEING_BUCKETS.map((bucket) => (
                                                <TableCell
                                                    key={bucket}
                                                    data-mobile={bucket === "d90" ? undefined : "hide"}
                                                    data-label={bucket === "d90" ? AGEING_LABELS[bucket] : undefined}
                                                    className={`py-2 text-right tabular-nums ${bucket === "d90" && r.ageing[bucket] > 0 ? "text-red-700 font-medium" : "text-slate-600"}`}
                                                >
                                                    {r.ageing[bucket] === 0 ? <span className="text-slate-300">—</span> : money(r.ageing[bucket])}
                                                </TableCell>
                                            ))}
                                            <TableCell data-label="Owing" className={`py-2 text-right tabular-nums font-semibold ${r.ageing.total < 0 ? "text-teal-700" : "text-slate-800"}`}>{money(r.ageing.total)}</TableCell>
                                            <TableCell className="pr-4 py-2 text-right whitespace-nowrap">
                                                <Link href={`${base}/customers/${r.customerId}/statement`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-700" title="Statement">
                                                    <FileText className="w-3.5 h-3.5" />
                                                </Link>
                                                {wa && (
                                                    <a href={wa} target="_blank" rel="noopener noreferrer" className="ml-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-teal-700" title={`WhatsApp ${r.mobile}`}>
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-6">
                    <span className="text-xs text-slate-500">
                        {rows.length} account{rows.length === 1 ? "" : "s"}
                        {unapplied > 0 && <> · {money(unapplied)} already on account and netted off</>}
                    </span>
                    <dl className="flex flex-wrap items-end gap-6 text-xs">
                        {AGEING_BUCKETS.map((bucket) => (
                            <div key={bucket} className="text-right">
                                <dt className="text-[10px] uppercase tracking-wider text-slate-400">{AGEING_LABELS[bucket]}</dt>
                                <dd className={`tabular-nums font-medium ${bucket === "d90" && totals[bucket] > 0 ? "text-red-700" : "text-slate-700"}`}>{money(totals[bucket])}</dd>
                            </div>
                        ))}
                        <div className="text-right border-l pl-6">
                            <dt className="text-[10px] uppercase tracking-wider text-slate-400">Total owing</dt>
                            <dd className="text-base tabular-nums font-bold text-slate-800">{money(totals.total)}</dd>
                        </div>
                    </dl>
                </div>
            </Card>
        </div>
    );
}
