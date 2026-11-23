import Link from "next/link";
import { Users, Plus, Pencil, Car, MessageCircle, Mail } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CustomerListControls } from "@/components/customers/CustomerListControls";
import type { listCustomers } from "@/lib/customers/queries";
import { DownloadIcon } from "@/components/exports/DownloadPair";
import { whatsappLink } from "@/lib/format";
import { Pager } from "@/components/ui/pager";

type Data = Awaited<ReturnType<typeof listCustomers>>;

const iconBtn = "inline-flex items-center justify-center w-8 h-7 rounded-sm border transition-colors";
const teal = `${iconBtn} relative hit-area border-[var(--motion-field-edge)] text-teal-700 bg-white hover:bg-slate-50`;
const disabled = `${iconBtn} border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed`;


export function CustomerList({ tenant, data, q, archived }: { tenant: string; data: Data; q: string; archived: boolean }) {
    const base = `/${tenant}/dashboard/customers`;
    const pageHref = (p: number) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (archived) params.set("archived", "1");
        if (p > 1) params.set("page", String(p));
        return `${base}${params.size ? `?${params}` : ""}`;
    };
    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col">
            <Card className="rounded-none shadow-none border border-slate-200">
                {/* A single non-wrapping row of title, filters, search and Add is
                    574px wide — it clipped inside a 341px card on a phone, taking
                    the search field and the Add button off-screen with it. It
                    wraps to two rows below `sm` and keeps its fixed height above. */}
                <CardHeader className="flex flex-col items-stretch gap-2 space-y-0 border-b bg-slate-200 px-4 py-2 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-slate-600" />
                        <h1 data-slot="card-title" className="leading-none text-lg text-slate-800 font-bold">Customers</h1>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <CustomerListControls q={q} archived={archived} />
                        <DownloadIcon tenant={tenant} report="customers" params={{ archived: archived ? "1" : undefined }} title="Download every customer as a spreadsheet" />
                        <Button asChild size="icon" variant="outline" className="w-8 h-8 rounded-sm bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600 shadow-sm" title="Add customer" aria-label="Add customer">
                            <Link href={`${base}/new`}><Plus className="w-5 h-5" /></Link>
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-0 flex-1 overflow-auto bg-white">
                    <Table data-mobile="cards">
                        <TableHeader>
                            <TableRow className="bg-white hover:bg-white text-xs border-b border-slate-200">
                                <TableHead className="w-[30%] text-slate-500 font-semibold pl-4">Customer</TableHead>
                                <TableHead className="w-[18%] text-slate-500 font-semibold">Mobile</TableHead>
                                <TableHead className="w-[18%] text-slate-500 font-semibold">Phone</TableHead>
                                <TableHead className="w-[8%] text-slate-500 font-semibold text-center">Vehicles</TableHead>
                                <TableHead className="text-right pr-4"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.rows.length === 0 && (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                                    {q ? <>No customers match “{q}”.</> : archived ? "No archived customers." : <>No customers yet. <Link href={`${base}/new`} className="text-teal-700 underline">Add the first one</Link>.</>}
                                </TableCell></TableRow>
                            )}
                            {data.rows.map((c, i) => {
                                const wa = whatsappLink(c.mobile);
                                return (
                                    <TableRow key={c.id} className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none transition-colors group`}>
                                        <TableCell data-mobile="primary" className="text-slate-700 py-2 pl-4 text-sm font-medium">
                                            <Link href={`${base}/${c.id}`} className="hover:text-teal-700">{c.firstName} {c.lastName}</Link>
                                            {c.isBusiness && <span className="ml-2 text-[9px] uppercase tracking-wider text-slate-500 border border-slate-300 rounded px-1">Business</span>}
                                        </TableCell>
                                        <TableCell data-label="Mobile" className="text-slate-600 py-2 text-sm tabular-nums">{c.mobile}</TableCell>
                                        <TableCell data-label="Phone" className="text-slate-600 py-2 text-sm tabular-nums">{c.phone}</TableCell>
                                        <TableCell data-label="Vehicles" className="text-slate-600 py-2 text-sm text-center tabular-nums">{c._count.vehicles || ""}</TableCell>
                                        <TableCell className="text-right py-2 pr-4">
                                            <div className="flex justify-start gap-3 pt-2 opacity-80 transition-opacity group-hover:opacity-100 sm:justify-end sm:gap-1 sm:pt-0">
                                                {/* Grouped rather than hidden one by one: `iconBtn` already sets
                                                    `inline-flex`, so a `hidden` on the same element is two display
                                                    utilities fighting and stylesheet order decides the winner, not
                                                    class order. A wrapper with no competing display class settles it.
                                                    Edit is reachable by tapping the name; booking and invoice are
                                                    counter work, not something done at a car. */}
                                                <span className="hidden gap-1 sm:flex">
                                                    <Link href={`${base}/${c.id}`} className={teal} title="Edit" aria-label={`Edit ${c.firstName} ${c.lastName}`}><Pencil className="w-4 h-4" aria-hidden="true" /></Link>
                                                    <Link href={`${base}/${c.id}#vehicles`} className={teal} title="Vehicles" aria-label={`Vehicles of ${c.firstName} ${c.lastName}`}><Car className="w-4 h-4" aria-hidden="true" /></Link>
                                                </span>
                                                {wa ? <a href={wa} target="_blank" rel="noreferrer" className={teal} title="WhatsApp" aria-label={`WhatsApp ${c.firstName} ${c.lastName} (opens in a new tab)`}><MessageCircle className="w-4 h-4" aria-hidden="true" /></a> : <span aria-hidden="true" className={disabled} title="No mobile number"><MessageCircle className="w-4 h-4" /></span>}
                                                {c.email ? <a href={`mailto:${c.email}`} className={teal} title="Email" aria-label={`Email ${c.firstName} ${c.lastName}`}><Mail className="w-4 h-4" aria-hidden="true" /></a> : <span aria-hidden="true" className={disabled} title="No email address"><Mail className="w-4 h-4" /></span>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>

                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                    <span className="text-xs text-slate-500 tabular-nums">{data.total} record{data.total === 1 ? "" : "s"}</span>
                    <Pager page={data.page} pages={data.pages} href={pageHref} ends />
                </div>
            </Card>
        </div>
    );
}
