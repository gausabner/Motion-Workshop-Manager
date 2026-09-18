import Link from "next/link";
import { ChevronLeft, ChevronRight, ListChecks, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JobStatusPill, StatePill } from "@/components/documents/StatusPill";
import { NewDocumentButtons } from "@/components/documents/NewDocumentButtons";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import { dateShort, money } from "@/lib/format";
import type { listDocuments } from "@/lib/documents/queries";

type Data = Awaited<ReturnType<typeof listDocuments>>;

export const TABS = [
    { key: "all", label: "All" },
    { key: "bookings", label: "Bookings" },
    { key: "jobs", label: "Jobs" },
    { key: "quotes", label: "Quotes" },
    { key: "invoices", label: "Invoices" },
    { key: "unpaid", label: "Unpaid" },
    { key: "credits", label: "Credits" },
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
            <Card className="rounded-none shadow-none border border-slate-200">
                <CardHeader className="bg-slate-200 border-b py-2 px-4 flex flex-row items-center justify-between space-y-0 h-14">
                    <div className="flex items-center gap-3">
                        <ListChecks className="w-5 h-5 text-slate-600" />
                        <CardTitle className="text-lg text-slate-800 font-bold">Transaction Centre</CardTitle>
                    </div>
                    <div className="flex items-center gap-3">
                        <form action={base} method="get" className="flex items-center gap-2">
                            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
                            <input
                                type="search" name="q" defaultValue={q} placeholder="Number, plate or customer…"
                                className="h-8 w-64 rounded-sm border border-slate-300 bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                            />
                        </form>
                        <NewDocumentButtons tenant={tenant} />
                    </div>
                </CardHeader>

                <div className="flex items-center gap-1 border-b bg-white px-4 overflow-x-auto">
                    {TABS.map((t) => (
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
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-white hover:bg-white text-xs border-b border-slate-200">
                                    <TableHead className="pl-4 text-slate-500 font-semibold">Date</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Number</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Type</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Customer</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Vehicle</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Status</TableHead>
                                    <TableHead className="text-slate-500 font-semibold">Comment</TableHead>
                                    <TableHead className="text-slate-500 font-semibold text-center">Told</TableHead>
                                    <TableHead className="text-slate-500 font-semibold text-right pr-4">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.rows.length === 0 && (
                                    <TableRow><TableCell colSpan={9} className="py-10 text-center text-sm text-slate-500">
                                        {q ? <>Nothing matches “{q}”.</> : "Nothing here yet. Start a booking, quote, job card or invoice above."}
                                    </TableCell></TableRow>
                                )}
                                {data.rows.map((d, i) => (
                                    <TableRow key={d.id} className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none text-sm`}>
                                        <TableCell className="pl-4 py-2 tabular-nums text-slate-600 whitespace-nowrap">{dateShort(d.scheduledAt ?? d.postDate)}</TableCell>
                                        <TableCell className="py-2 font-medium">
                                            <Link href={`/${tenant}/dashboard/documents/${d.id}`} className="text-slate-700 hover:text-teal-700">
                                                {d.number ?? d.jobNumber ?? "draft"}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="py-2 text-slate-600 whitespace-nowrap">
                                            {DOCUMENT_TYPE_LABELS[d.type]} <StatePill state={d.state} />
                                        </TableCell>
                                        <TableCell className="py-2 text-slate-600">
                                            {d.customer ? `${d.customer.firstName} ${d.customer.lastName}` : <span className="text-slate-400">Cash sale</span>}
                                            {d.description && <span className="block text-[11px] text-slate-400 truncate max-w-[220px]" title={d.description}>{d.description}</span>}
                                        </TableCell>
                                        <TableCell className="py-2 text-slate-600 whitespace-nowrap">
                                            {d.vehicle ? <span className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 text-[11px] font-bold px-1.5 py-0.5 rounded">{d.vehicle.plate}</span> : ""}
                                        </TableCell>
                                        <TableCell className="py-2">{d.jobStatus ? <JobStatusPill status={d.jobStatus} /> : ""}</TableCell>
                                        <TableCell className="py-2 text-slate-500 text-xs max-w-[180px] truncate" title={d.statusComment ?? ""}>{d.statusComment}</TableCell>
                                        <TableCell className="py-2 text-center">{d.contactedAt ? <MessageCircle className="w-3.5 h-3.5 text-teal-600 inline" aria-label={`Contacted ${dateShort(d.contactedAt)}`} /> : ""}</TableCell>
                                        <TableCell className="py-2 pr-4 text-right tabular-nums font-medium text-slate-700">
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
