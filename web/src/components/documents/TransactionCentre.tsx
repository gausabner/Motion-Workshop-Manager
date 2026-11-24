import Link from "next/link";
import { ListChecks, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JobStatusPill, StatePill } from "@/components/documents/StatusPill";
import { NewDocumentButtons } from "@/components/documents/NewDocumentButtons";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import { dateShort, money } from "@/lib/format";
import type { listDocuments } from "@/lib/documents/queries";
import { TERM } from "@/lib/copy/terms";
import { Pager } from "@/components/ui/pager";
import { ListHeader } from "@/components/layout/ListHeader";
import { Input } from "@/components/ui/input";

type Data = Awaited<ReturnType<typeof listDocuments>>;

export const TABS = [
    { key: "all", label: "All" },
    { key: "bookings", label: "Bookings" },
    { key: "jobs", label: "Job cards" },
    { key: "quotes", label: "Quotes" },
    { key: "invoices", label: "Invoices" },
    { key: "unpaid", label: "Unpaid" },
    { key: "credits", label: "Credit notes" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export function TransactionCentre({ tenant, data, tab, q }: { tenant: string; data: Data; tab: TabKey; q: string }) {
    const base = `/${tenant}/dashboard/transactions`;
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
                <ListHeader icon={ListChecks} title={TERM.transactions} count={data.total} noun={data.total === 1 ? "record" : "records"}>
                    <form role="search" aria-label={TERM.transactions} action={base} method="get" className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
                        {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                        <Input type="search" name="q" defaultValue={q} aria-label={`Search ${TERM.transactions.toLowerCase()}`} placeholder="Number, plate or customer…" className="h-8 px-2 text-base sm:w-64 sm:text-sm" />
                    </form>
                    <NewDocumentButtons tenant={tenant} />
                </ListHeader>

                <nav aria-label="Filter" className="flex items-center gap-1 border-b bg-white px-4 overflow-x-auto">
                    {TABS.map((t) => (
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
                                    <TableHead className="text-slate-500 font-semibold">Type</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Customer</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Vehicle</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Status</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Comment</TableHead>
                                    <TableHead className="text-slate-500 font-semibold text-center">Sent</TableHead>
                                    <TableHead className="text-slate-500 font-semibold text-right pr-4">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.rows.length === 0 && (
                                    <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-slate-500">
                                        {q ? <>No documents match “{q}”.</> : "No documents yet. Create a booking, quote, job card or invoice above."}
                                    </TableCell></TableRow>
                                )}
                                {data.rows.map((d, i) => (
                                    <TableRow key={d.id} className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none text-sm`}>
                                        <TableCell data-label="Date" className="pl-4 py-2 tabular-nums text-slate-600 whitespace-nowrap">{dateShort(d.scheduledAt ?? d.postDate)}</TableCell>
                                        <TableCell data-mobile="primary" className="py-2 font-medium">
                                            <Link href={`/${tenant}/dashboard/documents/${d.id}`} className="text-slate-700 hover:text-teal-700">
                                                {d.number ?? d.jobNumber ?? "draft"}
                                            </Link>
                                        </TableCell>
                                        <TableCell data-label="Type" className="py-2 text-slate-600 whitespace-nowrap">
                                            {DOCUMENT_TYPE_LABELS[d.type]} <StatePill state={d.state} type={d.type} />
                                        </TableCell>
                                        <TableCell data-label="Customer" className="py-2 text-slate-600">
                                            {d.customer ? `${d.customer.firstName} ${d.customer.lastName}` : <span className="text-slate-500">Cash sale</span>}
                                            {d.description && <span className="block text-[11px] text-slate-500 truncate max-w-[220px]" title={d.description}>{d.description}</span>}
                                        </TableCell>
                                        <TableCell data-label="Vehicle" className="py-2 text-slate-600 whitespace-nowrap">
                                            {d.vehicle ? <span className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 text-[11px] font-bold px-1.5 py-0.5 rounded">{d.vehicle.plate}</span> : ""}
                                        </TableCell>
                                        <TableCell data-label="Status" className="py-2">{d.jobStatus ? <JobStatusPill status={d.jobStatus} /> : ""}</TableCell>
                                        <TableCell data-mobile="hide" className="py-2 text-slate-500 text-xs max-w-[180px] truncate" title={d.statusComment ?? ""}>{d.statusComment}</TableCell>
                                        <TableCell data-mobile="hide" className="py-2 text-center">{d.contactedAt ? <MessageCircle className="w-3.5 h-3.5 text-teal-700 inline" aria-label={`Sent ${dateShort(d.contactedAt)}`} /> : ""}</TableCell>
                                        <TableCell data-label="Total" className="py-2 pr-4 text-right tabular-nums font-medium text-slate-700">
                                            {money(d.total)}
                                            {d.amountPaid > 0 && d.amountPaid < d.total && <span className="block text-[10px] text-amber-700">{money(d.total - d.amountPaid)} due</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                    <span className="text-xs text-slate-500 tabular-nums">{data.total} record{data.total === 1 ? "" : "s"}</span>
                    <Pager page={data.page} pages={data.pages} href={(page) => href({ page })} />
                </div>
            </Card>
        </div>
    );
}
