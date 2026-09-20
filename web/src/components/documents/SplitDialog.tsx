"use client";

import { useState, useTransition } from "react";
import { Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CustomerPicker } from "@/components/forms/CustomerPicker";
import type { PickerHit } from "@/lib/search/types";
import { splitByExcess, splitPreview, type SplitLine } from "@/lib/documents/split";
import { splitDocumentAction } from "@/lib/documents/split-actions";
import { money } from "@/lib/format";

/**
 * One job, two payers. The insurance case is the reason this exists: the
 * insurer pays the repair less the excess, and the customer pays the excess,
 * and the two invoices still add up to the job.
 */
export function SplitDialog({ tenant, documentId, lines, total, currency }: { tenant: string; documentId: string; lines: SplitLine[]; total: number; currency: string }) {
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"excess" | "lines">("excess");
    const [payer, setPayer] = useState<PickerHit | null>(null);
    const [excess, setExcess] = useState("");
    const [moving, setMoving] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string>();
    const [busy, start] = useTransition();

    const excessValue = Number(excess) || 0;
    const byExcess = splitByExcess(total, excessValue);
    const byLines = splitPreview(lines, moving);

    return (
        <>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}><Scissors className="mr-1 h-4 w-4" />Split</Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Split this job between two payers</DialogTitle>
                        <DialogDescription>
                            The other payer gets an invoice of their own, linked to this one. Nothing is sent anywhere; both stay drafts until you process them.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex overflow-hidden rounded-md border border-slate-300 text-sm">
                            {([["excess", "An insurer pays, less an excess"], ["lines", "Pick the lines they pay"]] as const).map(([value, label]) => (
                                <button key={value} type="button" onClick={() => setMode(value)} className={`flex-1 px-3 py-2 ${mode === value ? "bg-teal-600 text-white" : "bg-white text-slate-600"}`}>{label}</button>
                            ))}
                        </div>

                        <CustomerPicker tenant={tenant} label="Bill the other half to" value={payer} onChange={setPayer} name="splitCustomerId" />

                        {mode === "excess" ? (
                            <div className="space-y-2">
                                <label className="block space-y-1 text-sm">
                                    <span className="text-slate-600">Excess the customer pays</span>
                                    <input value={excess} onChange={(e) => setExcess(e.target.value)} inputMode="decimal" placeholder="e.g. 3500" className="h-9 w-40 rounded-md border border-slate-300 px-2 text-right text-sm tabular-nums" />
                                </label>
                                <dl className="rounded-sm bg-slate-50 px-3 py-2 text-sm">
                                    <span className="flex justify-between"><dt className="text-slate-500">This job</dt><dd className="tabular-nums text-slate-700">{money(total, currency)}</dd></span>
                                    <span className="flex justify-between"><dt className="text-slate-500">Stays here, for the customer</dt><dd className="tabular-nums text-slate-800">{money(byExcess.toOriginal, currency)}</dd></span>
                                    <span className="flex justify-between font-medium"><dt className="text-slate-600">Goes to the other payer</dt><dd className="tabular-nums text-slate-900">{money(byExcess.toPayer, currency)}</dd></span>
                                </dl>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <ul className="max-h-56 divide-y divide-slate-100 overflow-auto rounded-sm border border-slate-200">
                                    {lines.map((line) => (
                                        <li key={line.id}>
                                            <label className="flex items-center gap-2 px-3 py-1.5 text-sm">
                                                <input
                                                    type="checkbox" checked={moving.has(line.id)} className="accent-teal-600"
                                                    onChange={(e) => setMoving((m) => { const next = new Set(m); if (e.target.checked) next.add(line.id); else next.delete(line.id); return next; })}
                                                />
                                                <span className="min-w-0 flex-1 truncate text-slate-700">{line.description}</span>
                                                <span className="tabular-nums text-slate-600">{money(line.lineTotal, currency)}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-sm text-slate-600">
                                    {money(byLines.moved, currency)} moves across, {money(byLines.kept, currency)} stays here.
                                </p>
                            </div>
                        )}

                        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                            <Button
                                type="button" className="bg-teal-600 hover:bg-teal-700" disabled={busy || !payer}
                                onClick={() => start(async () => {
                                    setError(undefined);
                                    const result = await splitDocumentAction(tenant, documentId, { customerId: payer?.id ?? "", mode, excess: mode === "excess" ? excess : "", lineIds: [...moving] });
                                    if (result && !result.ok) setError(result.message);
                                })}
                            >
                                {busy ? "Splitting…" : "Make the split"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
