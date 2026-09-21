"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Car, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOAN_STATE_LABELS, loanSummary } from "@/lib/loans/rules";
import { bookLoanAction, cancelLoanAction, handOverAction, saveLoanVehicleAction, takeBackAction } from "@/lib/loans/actions";
import type { loanFleet } from "@/lib/loans/service";

type Fleet = Awaited<ReturnType<typeof loanFleet>>;
const field = "h-8 rounded-md border border-slate-300 bg-white px-2 text-sm";

const when = (d: Date | string, timezone: string) =>
    new Date(d).toLocaleString("en-GB", { timeZone: timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The courtesy cars, and who has them. What a counter needs at a glance is
 * which car is free, which is out, and which should have been back by now.
 */
export function LoanFleet({ tenant, fleet, timezone, customers, jobs, today }: {
    tenant: string; fleet: Fleet; timezone: string;
    customers: { id: string; label: string }[]; jobs: { id: string; label: string; customerId: string | null }[]; today: string;
}) {
    const router = useRouter();
    const [adding, setAdding] = useState(false);
    const [booking, setBooking] = useState<string | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, start] = useTransition();

    const run = (work: () => Promise<{ ok: boolean; message?: string }>) => start(async () => {
        const result = await work();
        setMessage(result.ok ? null : { ok: false, text: result.message ?? "That did not work" });
        if (result.ok) { setBooking(null); setAdding(false); router.refresh(); }
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                    {fleet.filter((v) => v.out).length} out · {fleet.filter((v) => v.active && !v.out).length} free · {fleet.filter((v) => v.overdue).length} overdue
                </p>
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding((a) => !a)}><Plus className="mr-1 h-4 w-4" />Add a courtesy car</Button>
            </div>

            {adding && (
                <form
                    className="flex flex-wrap items-end gap-2 rounded-sm border border-slate-200 bg-white px-4 py-3"
                    action={(fd) => run(() => saveLoanVehicleAction(tenant, null, {
                        plate: String(fd.get("plate") ?? ""), make: String(fd.get("make") ?? ""), model: String(fd.get("model") ?? ""),
                        year: String(fd.get("year") ?? ""), colour: String(fd.get("colour") ?? ""), odometer: String(fd.get("odometer") ?? ""), active: true,
                    }))}
                >
                    <label className="space-y-1 text-xs text-slate-500"><span className="block">Registration</span><input name="plate" required className={`${field} w-32`} /></label>
                    <label className="space-y-1 text-xs text-slate-500"><span className="block">Make</span><input name="make" className={`${field} w-32`} /></label>
                    <label className="space-y-1 text-xs text-slate-500"><span className="block">Model</span><input name="model" className={`${field} w-32`} /></label>
                    <label className="space-y-1 text-xs text-slate-500"><span className="block">Year</span><input name="year" inputMode="numeric" className={`${field} w-20`} /></label>
                    <label className="space-y-1 text-xs text-slate-500"><span className="block">Colour</span><input name="colour" className={`${field} w-24`} /></label>
                    <label className="space-y-1 text-xs text-slate-500"><span className="block">Odometer</span><input name="odometer" inputMode="numeric" className={`${field} w-24`} /></label>
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy}>Add</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                </form>
            )}

            {message && <p className="rounded-sm border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{message.text}</p>}

            {fleet.length === 0 && <p className="rounded-sm border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">No courtesy cars yet. Add the ones you lend out and they can be booked against a job.</p>}

            <ul className="space-y-3">
                {fleet.map((car) => (
                    <li key={car.id} className={`rounded-sm border bg-white ${car.overdue ? "border-amber-300" : "border-slate-200"}`}>
                        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5">
                            <Car className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="min-w-0">
                                <span className="block font-medium text-slate-800">{car.plate}{car.active ? "" : " · off the road"}</span>
                                <span className="block text-xs text-slate-500">{[car.year, car.make, car.model, car.colour].filter(Boolean).join(" ")}{car.odometer ? ` · ${car.odometer.toLocaleString("en-NA")} km` : ""}</span>
                            </span>
                            <span className="ml-auto flex flex-wrap items-center gap-2">
                                {car.out ? (
                                    <>
                                        <span className={`text-sm ${car.overdue ? "font-medium text-amber-700" : "text-slate-600"}`}>
                                            With {car.out.customer ? `${car.out.customer.firstName} ${car.out.customer.lastName}` : "someone"} · due {when(car.out.dueBackAt, timezone)}
                                            {car.overdue ? " · overdue" : ""}
                                        </span>
                                        <ReturnForm tenant={tenant} loanId={car.out.id} busy={busy} onRun={run} />
                                    </>
                                ) : (
                                    <>
                                        {car.next && (
                                            <span className="text-sm text-slate-600">
                                                Booked {when(car.next.outAt, timezone)}
                                                {car.next.customer ? ` for ${car.next.customer.firstName} ${car.next.customer.lastName}` : ""}
                                            </span>
                                        )}
                                        {car.next ? (
                                            <>
                                                <HandOverForm tenant={tenant} loanId={car.next.id} busy={busy} onRun={run} />
                                                <Button type="button" size="sm" variant="ghost" className="text-slate-500" disabled={busy} onClick={() => run(() => cancelLoanAction(tenant, car.next!.id))}>Cancel</Button>
                                            </>
                                        ) : car.active ? (
                                            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setBooking(booking === car.id ? null : car.id)}>Book it out</Button>
                                        ) : null}
                                    </>
                                )}
                            </span>
                        </div>

                        {booking === car.id && (
                            <form
                                className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3"
                                action={(fd) => run(() => bookLoanAction(tenant, {
                                    loanVehicleId: car.id, customerId: String(fd.get("customerId") ?? ""), documentId: String(fd.get("documentId") ?? ""),
                                    outAt: String(fd.get("outAt") ?? ""), dueBackAt: String(fd.get("dueBackAt") ?? ""), note: String(fd.get("note") ?? ""),
                                }))}
                            >
                                <label className="space-y-1 text-xs text-slate-500"><span className="block">Who is taking it</span>
                                    <select name="customerId" className={`${field} w-56`}>
                                        <option value="">Not said</option>
                                        {customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 text-xs text-slate-500"><span className="block">While we have their car in for</span>
                                    <select name="documentId" className={`${field} w-56`}>
                                        <option value="">No job</option>
                                        {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
                                    </select>
                                </label>
                                <label className="space-y-1 text-xs text-slate-500"><span className="block">Out</span><input type="datetime-local" name="outAt" defaultValue={`${today}T08:00`} className={`${field} w-44`} /></label>
                                <label className="space-y-1 text-xs text-slate-500"><span className="block">Due back</span><input type="datetime-local" name="dueBackAt" defaultValue={`${today}T17:00`} className={`${field} w-44`} /></label>
                                <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy}>Book</Button>
                            </form>
                        )}

                        {car.loans.length > 0 && (
                            <ul className="divide-y divide-slate-100 text-sm">
                                {car.loans.map((loan) => {
                                    const summary = loanSummary(loan, new Date());
                                    return (
                                        <li key={loan.id} className="flex flex-wrap items-center gap-x-3 px-4 py-1.5 text-xs text-slate-500">
                                            <span className="font-medium text-slate-600">{LOAN_STATE_LABELS[loan.state]}</span>
                                            <span>{when(loan.outAt, timezone)} → {when(loan.dueBackAt, timezone)}</span>
                                            {loan.customer && <span>{loan.customer.firstName} {loan.customer.lastName}{loan.customer.mobile ? ` · ${loan.customer.mobile}` : ""}</span>}
                                            {loan.document && <Link href={`/${tenant}/dashboard/documents/${loan.document.id}`} className="hover:text-teal-700">{loan.document.jobNumber ?? loan.document.number}</Link>}
                                            {loan.state === "OUT" && <span>{summary.elapsed}</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function HandOverForm({ tenant, loanId, busy, onRun }: { tenant: string; loanId: string; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; message?: string }>) => void }) {
    const [open, setOpen] = useState(false);
    if (!open) return <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setOpen(true)}>Hand it over</Button>;
    return (
        <form className="flex items-end gap-2" action={(fd) => onRun(() => handOverAction(tenant, loanId, String(fd.get("odometerOut") ?? ""), String(fd.get("agreedBy") ?? "")))}>
            <input name="odometerOut" inputMode="numeric" placeholder="Odometer out" className={`${field} w-28`} aria-label="Odometer going out" />
            <input name="agreedBy" placeholder="Who signed" className={`${field} w-32`} aria-label="Who signed for it" />
            <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy}>Out</Button>
        </form>
    );
}

function ReturnForm({ tenant, loanId, busy, onRun }: { tenant: string; loanId: string; busy: boolean; onRun: (work: () => Promise<{ ok: boolean; message?: string }>) => void }) {
    const [open, setOpen] = useState(false);
    if (!open) return <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>Take it back</Button>;
    return (
        <form className="flex items-end gap-2" action={(fd) => onRun(() => takeBackAction(tenant, loanId, String(fd.get("odometerIn") ?? ""), String(fd.get("note") ?? "")))}>
            <input name="odometerIn" inputMode="numeric" placeholder="Odometer back" className={`${field} w-28`} aria-label="Odometer coming back" />
            <input name="note" placeholder="Anything to note" className={`${field} w-40`} aria-label="Note" />
            <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy}>Back</Button>
        </form>
    );
}
