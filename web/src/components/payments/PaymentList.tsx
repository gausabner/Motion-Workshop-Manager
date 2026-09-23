import Link from "next/link";
import { ChevronLeft, ChevronRight, Minus, Plus, Wallet } from "lucide-react";
import type { PaymentState } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPayment, createRefund } from "@/lib/payments/actions";
import type { listPayments } from "@/lib/payments/queries";
import { dateShort, money } from "@/lib/format";

type Data = Awaited<ReturnType<typeof listPayments>>;

export const PAYMENT_TABS = [
    { key: "all", label: "All" },
    { key: "drafts", label: "Drafts" },
    { key: "posted", label: "Posted" },
    { key: "unapplied", label: "Unapplied" },
    { key: "refunds", label: "Refunds" },
    { key: "void", label: "Void" },
] as const;

export type PaymentTabKey = (typeof PAYMENT_TABS)[number]["key"];

const STATE_STYLES: Record<PaymentState, string> = {
    DRAFT: "bg-slate-100 text-slate-600 border-slate-300",
    PROCESSED: "bg-green-50 text-green-700 border-green-300",
    VOID: "bg-red-50 text-red-700 border-red-300",
};
const STATE_LABELS: Record<PaymentState, string> = { DRAFT: "Draft", PROCESSED: "Posted", VOID: "Void" };

export function PaymentStatePill({ state }: { state: PaymentState }) {
    return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATE_STYLES[state]}`}>{STATE_LABELS[state]}</span>;
}

export function PaymentList({ tenant, data, tab, q, takenToday }: { tenant: string; data: Data; tab: PaymentTabKey; q: string; takenToday: number }) {
    const base = `/${tenant}/dashboard/payments`;
    const href = (next: { tab?: string; q?: string; page?: number }) => {
        const params = new URLSearchParams();
        const t = next.tab ?? tab;
        const query = next.q ?? q;
        if (t && t !== "all") params.set("tab", t);
        if (query) params.set("q", query);
        if (next.page && next.page > 1) params.set("page", String(next.page));
        return `${base}${params.size ? `?${params}` : ""}`;
    };

    return (
        <div className="w-full max-w-7xl mx-auto">
            <Card className="rounded-none shadow-none border border-slate-200">
                <CardHeader className="flex flex-col items-stretch gap-2 space-y-0 border-b bg-slate-200 px-4 py-2 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Wallet className="w-5 h-5 shrink-0 text-slate-600" />
                        <CardTitle className="whitespace-nowrap text-lg font-bold text-slate-800">Receipts &amp; refunds</CardTitle>
                        <span className="whitespace-nowrap text-xs text-slate-600">Taken today <strong className="tabular-nums">{money(takenToday)}</strong></span>
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                        <form action={base} method="get" className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-none">
                            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                            <input
                                type="search" name="q" defaultValue={q} placeholder="Receipt number, reference or customer…"
                                className="h-8 w-full min-w-0 rounded-sm border border-slate-300 bg-white px-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 sm:w-64 sm:text-sm"
                            />
                        </form>
                        <form action={createRefund.bind(null, tenant, undefined)}>
                            <Button type="submit" size="sm" variant="outline" className="h-8"><Minus className="w-3.5 h-3.5 mr-1" />Refund</Button>
                        </form>
                        <form action={createPayment.bind(null, tenant, undefined)}>
                            <Button type="submit" size="sm" className="h-8 bg-teal-600 hover:bg-teal-700"><Plus className="w-3.5 h-3.5 mr-1" />Take payment</Button>
                        </form>
                    </div>
                </CardHeader>

                <div className="flex items-center gap-1 border-b bg-white px-4 overflow-x-auto">
                    {PAYMENT_TABS.map((t) => (
                        <Link
                            key={t.key}
                            href={href({ tab: t.key, page: 1 })}
                            className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                                t.key === tab ? "border-teal-600 text-teal-700 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            {t.label}
                        </Link>
                    ))}
                </div>

                <CardContent className="p-0 bg-white">
                    <div className="overflow-x-auto">
                        <Table data-mobile="cards">
                            <TableHeader>
                                <TableRow className="bg-white hover:bg-white text-xs border-b border-slate-200">
                                    <TableHead className="pl-4 text-slate-500 font-semibold">Date</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Number</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Customer</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Tendered as</TableHead>
                                    <TableHead className="text-right text-slate-500 font-semibold">Amount</TableHead>
                                    <TableHead className="text-right text-slate-500 font-semibold">Applied</TableHead>
                                    <TableHead className="text-right pr-4 text-slate-500 font-semibold">Unapplied</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.rows.length === 0 && (
                                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                                        {q ? <>Nothing matches “{q}”.</> : "No receipts yet. Take payment above, or press Take payment on an invoice."}
                                    </TableCell></TableRow>
                                )}
                                {data.rows.map((p, i) => (
                                    <TableRow key={p.id} className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none text-sm`}>
                                        <TableCell data-label="Date" className="pl-4 py-2 tabular-nums text-slate-600 whitespace-nowrap">{dateShort(p.postDate)}</TableCell>
                                        <TableCell data-mobile="primary" className="py-2 font-medium whitespace-nowrap">
                                            <Link href={`${base}/${p.id}`} className="text-slate-700 hover:text-teal-700">{p.number ?? "draft"}</Link>{" "}
                                            <PaymentStatePill state={p.state} />
                                            {p.direction === "REFUND" && <span className="ml-1 inline-block rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">Refund</span>}
                                        </TableCell>
                                        <TableCell data-label="Customer" className="py-2 text-slate-600">
                                            {p.customer ? <Link href={`/${tenant}/dashboard/customers/${p.customer.id}`} className="hover:text-teal-700">{p.customer.firstName} {p.customer.lastName}</Link> : <span className="text-slate-400">Not chosen</span>}
                                        </TableCell>
                                        <TableCell data-label="Tendered as" className="py-2 text-slate-500 text-xs max-w-[260px] truncate" title={p.methods.map((m) => `${m.name}${m.reference ? ` ${m.reference}` : ""}`).join(", ")}>
                                            {p.methods.map((m) => m.name).join(" + ") || "—"}
                                        </TableCell>
                                        <TableCell data-label="Amount" className={`py-2 text-right tabular-nums font-medium ${p.direction === "REFUND" ? "text-red-700" : "text-slate-700"}`}>{money(p.amount)}</TableCell>
                                        <TableCell data-label="Applied" className="py-2 text-right tabular-nums text-slate-600">{money(p.allocated)}</TableCell>
                                        <TableCell data-label="Unapplied" className={`py-2 pr-4 text-right tabular-nums ${p.unapplied > 0 ? "text-amber-700 font-medium" : "text-slate-400"}`}>{money(p.unapplied)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                    <span className="text-xs text-slate-500 tabular-nums">{data.total} receipt{data.total === 1 ? "" : "s"}</span>
                    <div className="flex items-center border rounded border-slate-200 overflow-hidden bg-white shadow-sm h-8 text-xs">
                        <Link href={href({ page: data.page - 1 })} className={`px-3 h-full flex items-center border-r border-slate-200 ${data.page <= 1 ? "text-slate-300 pointer-events-none" : "text-slate-600 hover:bg-slate-50"}`}><ChevronLeft className="w-3.5 h-3.5" /></Link>
                        <span className="px-4 h-full flex items-center text-teal-600 font-semibold bg-slate-50 border-r border-slate-200 tabular-nums">{data.page} / {data.pages}</span>
                        <Link href={href({ page: data.page + 1 })} className={`px-3 h-full flex items-center ${data.page >= data.pages ? "text-slate-300 pointer-events-none" : "text-slate-600 hover:bg-slate-50"}`}><ChevronRight className="w-3.5 h-3.5" /></Link>
                    </div>
                </div>
            </Card>
        </div>
    );
}
