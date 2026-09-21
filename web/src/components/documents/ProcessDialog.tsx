"use client";

import { useActionState, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initialActionState } from "@/lib/forms";
import { processDocument } from "@/lib/documents/actions";
import { promptFor, suggestNextService } from "@/lib/documents/process-prompt";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import { dateInput, money } from "@/lib/format";
import type { DocumentRecord } from "@/lib/documents/queries";

const input = "h-9 w-full rounded-md border border-input bg-white px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500";

/**
 * Processing, with the questions that make sense for what is being processed
 * — and a plain statement of what pressing the button will do, because it
 * cannot be undone except by a credit note.
 */
export function ProcessDialog({ tenant, doc }: { tenant: string; doc: DocumentRecord }) {
    const [open, setOpen] = useState(false);
    const [state, action, pending] = useActionState(processDocument.bind(null, tenant, doc.id), initialActionState);
    const kind = promptFor(doc.type, !!doc.vehicle);
    const last = doc.vehicle?.odometer ?? null;
    const postDate = dateInput(doc.postDate);

    // Not prefilled with the car's last reading: that invites clicking straight through with a stale number.
    const [odometer, setOdometer] = useState(doc.odometer != null ? String(doc.odometer) : "");
    const reading = odometer.trim() ? Number(odometer.replace(/[\s,]/g, "")) : null;
    const suggestion = useMemo(() => suggestNextService(reading !== null && Number.isFinite(reading) ? reading : null, postDate), [reading, postDate]);
    const [nextKm, setNextKm] = useState(doc.nextServiceKm != null ? String(doc.nextServiceKm) : "");
    const [nextDate, setNextDate] = useState(doc.nextServiceDate ? dateInput(doc.nextServiceDate) : "");
    const lower = reading !== null && last !== null && reading < last;
    const e = (name: string) => state.errors?.[name]?.[0];

    const label = DOCUMENT_TYPE_LABELS[doc.type].toLowerCase();
    const onAccount = (doc.type === "INVOICE" || doc.type === "CREDIT") && doc.customer;

    return (
        <>
            <Button type="button" size="sm" className="bg-slate-800 hover:bg-slate-900" onClick={() => setOpen(true)}>
                <CheckCircle2 className="w-4 h-4 mr-1" />Process
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Process this {label}</DialogTitle>
                        <DialogDescription>
                            It takes the next {label} number and its lines lock.
                            {onAccount ? ` ${money(Math.abs(doc.total))} goes ${doc.type === "CREDIT" ? "back to" : "on"} ${doc.customer!.firstName}'s account.` : ""}
                            {" "}Changing it afterwards takes a credit note.
                        </DialogDescription>
                    </DialogHeader>

                    <form action={action} className="space-y-4">
                        {kind !== "none" && doc.vehicle && (
                            <div className="space-y-3 rounded-md border border-slate-200 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    {doc.vehicle.plate} · {kind === "service" ? "the service record" : "on arrival"}
                                </p>
                                <label className="block space-y-1">
                                    <span className="text-xs text-slate-600">Odometer{kind === "arrival" ? " (optional)" : ""}</span>
                                    <input name="odometer" inputMode="numeric" value={odometer} onChange={(ev) => setOdometer(ev.target.value)} placeholder={last !== null ? `Last reading ${last.toLocaleString("en-NA")} km` : "km"} className={input} />
                                    {e("odometer") && <span className="block text-xs text-red-600">{e("odometer")}</span>}
                                </label>
                                {lower && (
                                    <label className="flex items-start gap-2 text-xs text-amber-900">
                                        <input type="checkbox" name="odometerCorrected" className="mt-0.5 accent-teal-600" />
                                        That is lower than the last reading of {last!.toLocaleString("en-NA")} km — the clock was replaced, or that reading was wrong.
                                    </label>
                                )}

                                {kind === "service" && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="block space-y-1">
                                                <span className="text-xs text-slate-600">Next service (km)</span>
                                                <input name="nextServiceKm" inputMode="numeric" value={nextKm} onChange={(ev) => setNextKm(ev.target.value)} placeholder={suggestion.nextServiceKm ? suggestion.nextServiceKm.toLocaleString("en-NA") : "km"} className={input} />
                                                {e("nextServiceKm") && <span className="block text-xs text-red-600">{e("nextServiceKm")}</span>}
                                            </label>
                                            <label className="block space-y-1">
                                                <span className="text-xs text-slate-600">Next service (date)</span>
                                                <input name="nextServiceDate" type="date" value={nextDate} onChange={(ev) => setNextDate(ev.target.value)} className={input} />
                                                {e("nextServiceDate") && <span className="block text-xs text-red-600">{e("nextServiceDate")}</span>}
                                            </label>
                                        </div>
                                        {(!nextKm || !nextDate) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!nextKm && suggestion.nextServiceKm) setNextKm(String(suggestion.nextServiceKm));
                                                    if (!nextDate) setNextDate(suggestion.nextServiceDate);
                                                }}
                                                className="text-xs text-teal-700 hover:underline"
                                            >
                                                Use the usual interval — {suggestion.nextServiceKm ? `${suggestion.nextServiceKm.toLocaleString("en-NA")} km or ` : ""}{suggestion.nextServiceDate.split("-").reverse().join("/")}
                                            </button>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="block space-y-1">
                                                <span className="text-xs text-slate-600">Licence disc expires</span>
                                                <input name="licenceExpiry" type="date" defaultValue={doc.vehicle.licenceExpiry ? dateInput(doc.vehicle.licenceExpiry) : ""} className={input} />
                                            </label>
                                            <label className="block space-y-1">
                                                <span className="text-xs text-slate-600">Roadworthy expires</span>
                                                <input name="roadworthyExpiry" type="date" defaultValue={doc.vehicle.roadworthyExpiry ? dateInput(doc.vehicle.roadworthyExpiry) : ""} className={input} />
                                            </label>
                                        </div>
                                        <p className="text-[11px] text-slate-400">These go on the car&rsquo;s record and drive its reminders. Leave a renewal blank to keep what is on file.</p>
                                    </>
                                )}
                            </div>
                        )}

                        {state.message && !state.ok && <p className="text-sm text-red-600" role="alert">{state.message}</p>}
                        <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button type="submit" size="sm" className="bg-slate-800 hover:bg-slate-900" disabled={pending}>
                                <CheckCircle2 className="w-4 h-4 mr-1" />{pending ? "Processing…" : `Process ${label}`}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
