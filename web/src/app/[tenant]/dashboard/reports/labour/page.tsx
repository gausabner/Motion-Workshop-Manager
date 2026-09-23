import Link from "next/link";
import { AlertTriangle, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { labourReport } from "@/lib/time/queries";
import { addDays, startOfWeek, toZoned } from "@/lib/diary/time";
import { hoursLabel } from "@/lib/time/clock";

export const metadata = { title: "Mechanic time | MOTION Workshop Manager" };

const valid = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);

function tone(efficiency: number | null): string {
    if (efficiency === null) return "text-slate-400";
    if (efficiency >= 100) return "text-teal-700";
    if (efficiency >= 80) return "text-amber-700";
    return "text-red-700";
}

export default async function LabourReportPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "reports:view"))
        return <AccessDenied tenant={slug} group={membership.group} needs="see reports" />;

    const today = toZoned(new Date(), tenant.timezone).day;
    const from = valid(sp.from) ?? startOfWeek(today);
    const to = valid(sp.to) ?? addDays(startOfWeek(today), 6);
    const { rows, totals } = await labourReport(db, tenant, from, to);
    const base = `/${slug}/dashboard/reports/labour`;
    const week = (offset: number) => {
        const f = addDays(startOfWeek(today), offset * 7);
        return `${base}?from=${f}&to=${addDays(f, 6)}`;
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-3">
            <Card className="rounded-none shadow-none border border-slate-200">
                <CardHeader className="bg-slate-200 border-b py-2 px-4 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                    <div className="flex items-center gap-3">
                        <Timer className="w-5 h-5 text-slate-600" />
                        <CardTitle className="text-lg text-slate-800 font-bold">Mechanic time</CardTitle>
                    </div>
                    <form method="get" action={base} className="flex flex-wrap items-center gap-2 text-sm">
                        <Link href={week(-1)} className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">Last week</Link>
                        <Link href={week(0)} className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50">This week</Link>
                        <input type="date" name="from" defaultValue={from} className="h-8 rounded-sm border border-slate-300 bg-white px-2" aria-label="From" />
                        <input type="date" name="to" defaultValue={to} className="h-8 rounded-sm border border-slate-300 bg-white px-2" aria-label="To" />
                        <button type="submit" className="h-8 rounded-sm border border-slate-300 bg-white px-3 hover:bg-slate-50">Show</button>
                    </form>
                </CardHeader>
                <CardContent className="p-0 bg-white">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="text-xs">
                                    <TableHead className="pl-4 text-slate-500 font-semibold">Mechanic</TableHead>
                                    <TableHead className="text-right text-slate-500 font-semibold">Jobs</TableHead>
                                    <TableHead className="text-right text-slate-500 font-semibold">Worked</TableHead>
                                    <TableHead className="text-right text-slate-500 font-semibold">On invoiced jobs</TableHead>
                                    <TableHead className="text-right text-slate-500 font-semibold">Charged</TableHead>
                                    <TableHead className="text-right text-slate-500 font-semibold">Efficiency</TableHead>
                                    <TableHead className="text-right pr-4 text-slate-500 font-semibold">Not invoiced yet</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">No time was clocked in this period.</TableCell></TableRow>}
                                {rows.map((r) => (
                                    <TableRow key={r.mechanicId} className="text-sm">
                                        <TableCell className="pl-4 font-medium text-slate-700">
                                            {r.name}
                                            {r.suspect > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-amber-800"><AlertTriangle className="w-3.5 h-3.5" />{r.suspect} over ten hours</span>}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-slate-600">{r.jobs}</TableCell>
                                        <TableCell className="text-right tabular-nums font-medium text-slate-800">{hoursLabel(r.worked)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-slate-600">{hoursLabel(r.workedInvoiced)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-slate-600">{hoursLabel(r.charged)}</TableCell>
                                        <TableCell className={`text-right tabular-nums font-semibold ${tone(r.efficiency)}`}>{r.efficiency !== null ? `${r.efficiency}%` : "—"}</TableCell>
                                        <TableCell className="text-right pr-4 tabular-nums text-slate-500">{hoursLabel(r.workedPending)}</TableCell>
                                    </TableRow>
                                ))}
                                {rows.length > 1 && (
                                    <TableRow className="border-t-2 bg-slate-50 text-sm font-semibold">
                                        <TableCell className="pl-4 text-slate-700">Workshop</TableCell>
                                        <TableCell className="text-right tabular-nums">{totals.jobs}</TableCell>
                                        <TableCell className="text-right tabular-nums">{hoursLabel(totals.worked)}</TableCell>
                                        <TableCell className="text-right tabular-nums">{hoursLabel(totals.workedInvoiced)}</TableCell>
                                        <TableCell className="text-right tabular-nums">{hoursLabel(totals.charged)}</TableCell>
                                        <TableCell className={`text-right tabular-nums ${tone(totals.efficiency)}`}>{totals.efficiency !== null ? `${totals.efficiency}%` : "—"}</TableCell>
                                        <TableCell className="text-right pr-4 tabular-nums">{hoursLabel(totals.workedPending)}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            <p className="text-xs text-slate-500">
                Efficiency is labour charged on the invoice over time on the clock, for invoiced jobs only — a week of unfinished jobs does not read as a week of
                giving time away. When two mechanics worked one job, its charged hours are shared by how long each spent on it.
            </p>
        </div>
    );
}
