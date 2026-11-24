import Link from "next/link";
import { Car, Plus, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CustomerListControls } from "@/components/customers/CustomerListControls";
import type { listVehicles } from "@/lib/vehicles/queries";
import { dateShort } from "@/lib/format";
import { DownloadIcon } from "@/components/exports/DownloadPair";
import { Pager } from "@/components/ui/pager";
import { ListHeader } from "@/components/layout/ListHeader";

type Data = Awaited<ReturnType<typeof listVehicles>>;

export function VehicleList({ tenant, data, q, archived }: { tenant: string; data: Data; q: string; archived: boolean }) {
    const base = `/${tenant}/dashboard`;
    const pageHref = (p: number) => {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (archived) params.set("archived", "1");
        if (p > 1) params.set("page", String(p));
        return `${base}/vehicles${params.size ? `?${params}` : ""}`;
    };
    const soon = new Date();
    soon.setMonth(soon.getMonth() + 1);
    const flag = (d: Date | null) => (d && d < soon ? "text-amber-700 font-medium" : "");
    return (
        <div className="w-full max-w-7xl mx-auto h-full flex flex-col">
            <Card className="rounded-none shadow-none border border-slate-200 gap-0 py-0">
                <ListHeader icon={Car} title="Vehicles" count={data.total} noun={data.total === 1 ? "vehicle" : "vehicles"}>
                    <CustomerListControls q={q} archived={archived} />
                    <DownloadIcon tenant={tenant} report="vehicles" params={{ archived: archived ? "1" : undefined }} title="Download every vehicle as a spreadsheet" />
                    <Button asChild size="sm" className="h-8">
                        <Link href={`${base}/vehicles/new`}><Plus className="h-4 w-4" aria-hidden="true" />New vehicle</Link>
                    </Button>
                </ListHeader>
                <CardContent className="p-0 flex-1 overflow-auto bg-white">
                    <Table data-mobile="cards">
                        <TableHeader>
                            <TableRow className="bg-white hover:bg-white text-xs border-b border-slate-200">
                                <TableHead className="pl-4 text-slate-500 font-semibold">Plate</TableHead>
                                <TableHead className="text-slate-500 font-semibold">Vehicle</TableHead>
                                <TableHead className="text-slate-500 font-semibold">Customer</TableHead>
                                <TableHead className="text-slate-500 font-semibold text-right">Odometer</TableHead>
                                <TableHead className="text-slate-500 font-semibold">Licence disc</TableHead>
                                <TableHead className="text-slate-500 font-semibold">Roadworthy</TableHead>
                                <TableHead className="pr-4"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.rows.length === 0 && (
                                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">
                                    {q ? <>No vehicles match “{q}”.</> : archived ? "No archived vehicles." : <>No vehicles yet. <Link href={`${base}/vehicles/new`} className="text-teal-700 underline">Add the first one</Link>.</>}
                                </TableCell></TableRow>
                            )}
                            {data.rows.map((v, i) => (
                                <TableRow key={v.id} className={`${i % 2 === 0 ? "bg-slate-50" : "bg-white"} hover:bg-slate-100 border-none text-sm`}>
                                    <TableCell data-mobile="primary" className="pl-4 py-2"><Link href={`${base}/vehicles/${v.id}`} className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded">{v.plate}</Link></TableCell>
                                    <TableCell data-label="Vehicle" className="py-2 text-slate-700">{v.year ? `${v.year} ` : ""}{v.make} {v.model}</TableCell>
                                    <TableCell data-label="Customer" className="py-2 text-slate-600">{v.customer ? <Link href={`${base}/customers/${v.customer.id}`} className="hover:text-teal-700">{v.customer.firstName} {v.customer.lastName}</Link> : <span className="text-slate-500">—</span>}</TableCell>
                                    <TableCell data-label="Odometer" className="py-2 text-right tabular-nums text-slate-600">{v.odometer?.toLocaleString("en-NA") ?? ""}</TableCell>
                                    <TableCell data-label="Licence disc" className={`py-2 tabular-nums ${flag(v.licenceExpiry)}`}>{dateShort(v.licenceExpiry)}</TableCell>
                                    <TableCell className={`py-2 tabular-nums ${flag(v.roadworthyExpiry)}`}>{dateShort(v.roadworthyExpiry)}</TableCell>
                                    <TableCell className="relative hit-area py-2 pr-4 text-right"><Link href={`${base}/vehicles/${v.id}`} className="inline-flex items-center justify-center w-8 h-7 rounded-sm border border-teal-500 text-teal-700 bg-white hover:bg-teal-50 shadow-sm" title="Edit"><Pencil className="w-4 h-4" /></Link></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200">
                    <span className="text-xs text-slate-500 tabular-nums">{data.total} record{data.total === 1 ? "" : "s"}</span>
                    <Pager page={data.page} pages={data.pages} href={pageHref} />
                </div>
            </Card>
        </div>
    );
}
