import Link from "next/link";
import { Ban, CircleCheck, Minus, PencilLine, Plus, Wallet, type LucideIcon } from "lucide-react";
import type { PaymentState } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createPayment, createRefund } from "@/lib/payments/actions";
import type { listPayments } from "@/lib/payments/queries";
import { dateShort, money } from "@/lib/format";
import { Pager } from "@/components/ui/pager";
import { ObjectStatus } from "@/components/documents/StatusPill";
import { ListHeader } from "@/components/layout/ListHeader";
import { Input } from "@/components/ui/input";

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

const STATE: Record<PaymentState, { label: string; icon: LucideIcon; tone?: string }> = {
    DRAFT: { label: "Draft", icon: PencilLine, tone: "text-slate-700" },
    PROCESSED: { label: "Posted", icon: CircleCheck },
    VOID: { label: "Void", icon: Ban, tone: "text-red-700" },
};

export function PaymentStatePill({ state }: { state: PaymentState }) {
    const s = STATE[state];
    return <ObjectStatus icon={s.icon} label={s.label} tone={s.tone} />;
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
            <Card className="rounded-none shadow-none border border-slate-200 gap-0 py-0">
                <ListHeader icon={Wallet} title="Receipts & refunds" count={data.total} noun={data.total === 1 ? "receipt" : "receipts"} extra={<span className="whitespace-nowrap text-xs text-slate-600">Taken today <strong className="tabular-nums">{money(takenToday)}</strong></span>}>
                    <form role="search" aria-label="Receipts" action={base} method="get" className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-none">
                        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                        <Input type="search" name="q" defaultValue={q} aria-label="Search receipts" placeholder="Receipt number, reference or customer…" className="h-8 px-2 text-base sm:w-64 sm:text-sm" />
                    </form>
                    <form action={createRefund.bind(null, tenant, undefined)}>
                        <Button type="submit" size="sm" variant="outline" className="h-8"><Minus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />Refund</Button>
                    </form>
                    <form action={createPayment.bind(null, tenant, undefined)}>
                        <Button type="submit" size="sm" className="h-8"><Plus className="w-3.5 h-3.5 mr-1" aria-hidden="true" />Take payment</Button>
                    </form>
                </ListHeader>

                <nav aria-label="Filter" className="flex items-center gap-1 border-b bg-white px-4 overflow-x-auto">
                    {PAYMENT_TABS.map((t) => (
                        <Link
                            key={t.key}
                            href={href({ tab: t.key, page: 1 })}
                            aria-current={t.key === tab ? "page" : undefined}
                            className={`whitespace-nowrap px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                                t.key === tab ? "border-teal-700 text-teal-700 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            {t.label}
                        </Link>
                    ))}
                </nav>

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
                                        {q ? <>No receipts match “{q}”.</> : "No receipts yet. Take a payment above, or use Take payment on an invoice."}
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
                                            {p.customer ? <Link href={`/${tenant}/dashboard/customers/${p.customer.id}`} className="hover:text-teal-700">{p.customer.firstName} {p.customer.lastName}</Link> : <span className="text-slate-500">Not chosen</span>}
                                        </TableCell>
                                        <TableCell data-label="Tendered as" className="py-2 text-slate-500 text-xs max-w-[260px] truncate" title={p.methods.map((m) => `${m.name}${m.reference ? ` ${m.reference}` : ""}`).join(", ")}>
                                            {p.methods.map((m) => m.name).join(" + ") || "—"}
                                        </TableCell>
                                        <TableCell data-label="Amount" className={`py-2 text-right tabular-nums font-medium ${p.direction === "REFUND" ? "text-red-700" : "text-slate-700"}`}>{money(p.amount)}</TableCell>
                                        <TableCell data-label="Applied" className="py-2 text-right tabular-nums text-slate-600">{money(p.allocated)}</TableCell>
                                        <TableCell data-label="Unapplied" className={`py-2 pr-4 text-right tabular-nums ${p.unapplied > 0 ? "text-amber-700 font-medium" : "text-slate-500"}`}>{money(p.unapplied)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                    <span className="text-xs text-slate-500 tabular-nums">{data.total} receipt{data.total === 1 ? "" : "s"}</span>
                    <Pager page={data.page} pages={data.pages} href={(page) => href({ page })} />
                </div>
            </Card>
        </div>
    );
}
