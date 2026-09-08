"use client";

import { useActionState, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextField, SelectField, CheckField } from "@/components/forms/fields";
import { LineGrid, newLine, type EditorLine } from "@/components/documents/LineGrid";
import { saveDocument } from "@/lib/documents/actions";
import { initialActionState } from "@/lib/forms";
import { calculateTotals } from "@/lib/documents/totals";
import { JOB_STATUS_LABELS, JOB_STATUS_ORDER } from "@/lib/documents/types";
import { dateInput, money } from "@/lib/format";
import type { DocumentRecord, EditorOptions } from "@/lib/documents/queries";

type Props = {
    tenant: string;
    doc: DocumentRecord;
    options: EditorOptions;
    pricesIncludeTax: boolean;
    salesTaxRate: number;
    showCost: boolean;
};

function toEditorLines(doc: DocumentRecord): EditorLine[] {
    return doc.lines.map((l) => ({
        key: l.id,
        id: l.id,
        productId: l.productId,
        lineType: l.lineType,
        description: l.description,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        unitCost: Number(l.unitCost),
        vatRate: Number(l.vatRate),
        discountPercent: Number(l.discountPercent),
        serialNumbers: l.serialNumbers,
        isCustomerSupplied: l.isCustomerSupplied,
    }));
}

const localDateTime = (d: Date | string | null | undefined) => {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function DocumentEditor({ tenant, doc, options, pricesIncludeTax, salesTaxRate, showCost }: Props) {
    const readOnly = doc.state !== "DRAFT";
    const action = saveDocument.bind(null, tenant, doc.id);
    const [state, formAction, pending] = useActionState(action, initialActionState);
    const [lines, setLines] = useState<EditorLine[]>(() => toEditorLines(doc));
    const [customerId, setCustomerId] = useState(doc.customerId ?? "");
    const [vehicleId, setVehicleId] = useState(doc.vehicleId ?? "");
    const [isCashSale, setIsCashSale] = useState(doc.isCashSale);
    const [discountPercent, setDiscountPercent] = useState(doc.discountPercent ?? 0);
    const [freight, setFreight] = useState(doc.freight ?? 0);
    const errors = state.errors;

    const isJob = doc.type === "BOOKING" || doc.type === "JOB_CARD";
    const isFinancial = doc.type === "INVOICE" || doc.type === "CASH_SALE" || doc.type === "CREDIT";

    const totals = useMemo(
        () => calculateTotals({ lines, pricesIncludeTax, discountPercent: Number(discountPercent) || 0, freight: Number(freight) || 0, freightVatRate: salesTaxRate }),
        [lines, pricesIncludeTax, discountPercent, freight, salesTaxRate],
    );

    // Only this customer's vehicles, unless none is chosen yet.
    const vehicleOptions = useMemo(() => {
        const list = customerId ? options.vehicles.filter((v) => v.customerId === customerId) : options.vehicles;
        return list.map((v) => ({ value: v.id, label: `${v.plate} · ${v.year ? `${v.year} ` : ""}${v.make} ${v.model}` }));
    }, [customerId, options.vehicles]);

    return (
        <form action={formAction} className="space-y-4">
            <input type="hidden" name="lines" value={JSON.stringify(lines.map(({ key, ...rest }) => ({ ...rest, id: rest.id })))} />

            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-500">
                    {readOnly ? "Processed documents are read-only. Copy it or raise a credit note to make changes." : "Draft — nothing is posted until you process it."}
                </p>
                <div className="flex items-center gap-2">
                    {state.ok && state.message && <span className="text-sm text-teal-700">{state.message}</span>}
                    {state.message && !state.ok && <span className="text-sm text-red-600" role="alert">{state.message}</span>}
                    {!readOnly && (
                        <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={pending}>
                            <Save className="w-4 h-4 mr-1" />{pending ? "Saving…" : "Save"}
                        </Button>
                    )}
                </div>
            </div>

            <section className="border border-slate-200 rounded-sm bg-white">
                <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Details</h3>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <SelectField
                        label="Customer" name="customerId" errors={errors} allowEmpty={isCashSale ? "Cash sale" : "— choose —"}
                        value={customerId}
                        onChange={(v) => { setCustomerId(v); if (v && !options.vehicles.some((veh) => veh.id === vehicleId && veh.customerId === v)) setVehicleId(""); }}
                        disabled={readOnly}
                        options={options.customers.map((c) => ({ value: c.id, label: `${c.lastName}, ${c.firstName}${c.mobile ? ` · ${c.mobile}` : ""}` }))}
                        className="lg:col-span-2"
                    />
                    <SelectField label="Vehicle" name="vehicleId" errors={errors} value={vehicleId} onChange={setVehicleId} disabled={readOnly} allowEmpty="— none —" options={vehicleOptions} className="lg:col-span-2" />
                    <TextField label="Reference" name="reference" defaultValue={doc.reference} errors={errors} />
                    <TextField label="Customer order no." name="customerOrderNumber" defaultValue={doc.customerOrderNumber} errors={errors} />
                    <SelectField label="Service advisor" name="serviceAdvisorId" defaultValue={doc.serviceAdvisorId} errors={errors} allowEmpty="—" options={options.advisors.map((a) => ({ value: a.id, label: a.name }))} />
                    <SelectField label="Mechanic" name="mechanicId" defaultValue={doc.mechanicId} errors={errors} allowEmpty="— unassigned —" options={options.mechanics.map((m) => ({ value: m.id, label: m.name }))} />
                    <TextField label="Post date" name="postDate" type="date" defaultValue={dateInput(doc.postDate)} errors={errors} />
                    {isFinancial && <TextField label="Due date" name="dueDate" type="date" defaultValue={dateInput(doc.dueDate)} errors={errors} hint="Blank = from payment terms" />}
                    {doc.type === "QUOTE" && <TextField label="Follow up on" name="followUpDate" type="date" defaultValue={dateInput(doc.followUpDate)} errors={errors} />}
                    {isJob && <TextField label="Scheduled for" name="scheduledAt" type="datetime-local" defaultValue={localDateTime(doc.scheduledAt)} errors={errors} />}
                    {isJob && <TextField label="Estimated hours" name="estimatedHours" type="number" step="0.25" min="0" defaultValue={doc.estimatedHours} errors={errors} />}
                    <div className="lg:col-span-4 flex flex-wrap gap-6 pt-1">
                        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                            <input type="checkbox" name="isCashSale" defaultChecked={isCashSale} onChange={(e) => setIsCashSale(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" disabled={readOnly} />
                            <span>Cash sale<span className="block text-[11px] text-slate-400">No customer account</span></span>
                        </label>
                        <CheckField label="Internal job" name="isInternal" defaultChecked={doc.isInternal} hint="Excluded from sales reporting" />
                    </div>
                </div>
            </section>

            {isJob && (
                <section className="border border-slate-200 rounded-sm bg-white">
                    <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Job</h3>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                        <SelectField label="Status" name="jobStatus" defaultValue={doc.jobStatus ?? "BOOKED_IN"} errors={errors} options={JOB_STATUS_ORDER.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s] }))} />
                        <TextField label="Status comment" name="statusComment" defaultValue={doc.statusComment} errors={errors} className="lg:col-span-3" placeholder="e.g. waiting on brake pads from Midas" />
                    </div>
                </section>
            )}

            <section className="border border-slate-200 rounded-sm bg-white">
                <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vehicle readings</h3>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <TextField label="Odometer (km)" name="odometer" type="number" min="0" defaultValue={doc.odometer} errors={errors} hint="Written to the vehicle on process" />
                    <TextField label="Next service at (km)" name="nextServiceKm" type="number" min="0" defaultValue={doc.nextServiceKm} errors={errors} />
                    <TextField label="Next service date" name="nextServiceDate" type="date" defaultValue={dateInput(doc.nextServiceDate)} errors={errors} />
                    <SelectField label="Payment terms" name="paymentTermsDays" defaultValue={doc.paymentTermsDays != null ? String(doc.paymentTermsDays) : ""} errors={errors} allowEmpty="Workshop default"
                        options={[{ value: "0", label: "Cash on delivery" }, { value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }]} />
                </div>
            </section>

            <LineGrid lines={lines} onChange={setLines} products={options.products} pricesIncludeTax={pricesIncludeTax} salesTaxRate={salesTaxRate} showCost={showCost} readOnly={readOnly} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <section className="lg:col-span-2 border border-slate-200 rounded-sm bg-white">
                    <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes</h3>
                    <div className="p-4 space-y-3">
                        <Field label="Job card notes (workshop)" name="jobCardNotes" errors={errors}>
                            <textarea id="jobCardNotes" name="jobCardNotes" defaultValue={doc.jobCardNotes ?? ""} rows={3} disabled={readOnly} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm disabled:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500" />
                        </Field>
                        <Field label="Notes on the printed document (customer)" name="invoiceNotes" errors={errors}>
                            <textarea id="invoiceNotes" name="invoiceNotes" defaultValue={doc.invoiceNotes ?? ""} rows={3} disabled={readOnly} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm disabled:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500" />
                        </Field>
                    </div>
                </section>

                <section className="border border-slate-200 rounded-sm bg-white h-fit">
                    <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Totals</h3>
                    <div className="p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <TextField label="Discount %" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} errors={errors} disabled={readOnly} />
                            <TextField label="Freight" name="freight" type="number" step="0.01" min="0" defaultValue={freight} onChange={(e) => setFreight(Number(e.target.value))} errors={errors} disabled={readOnly} />
                        </div>
                        <input type="hidden" name="discountAmount" value={0} />
                        <dl className="pt-2 space-y-1.5 border-t border-slate-100">
                            <div className="flex justify-between"><dt className="text-slate-500">Subtotal (excl. VAT)</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
                            {totals.discountApplied > 0 && <div className="flex justify-between text-amber-700"><dt>Discount</dt><dd className="tabular-nums">− {money(totals.discountApplied)}</dd></div>}
                            <div className="flex justify-between"><dt className="text-slate-500">VAT</dt><dd className="tabular-nums">{money(totals.vatTotal)}</dd></div>
                            <div className="flex justify-between pt-1.5 border-t border-slate-200 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
                            {showCost && (
                                <div className="pt-2 mt-2 border-t border-dashed border-slate-200 space-y-1 text-xs">
                                    <div className="flex justify-between text-slate-500"><dt>Cost</dt><dd className="tabular-nums">{money(totals.totalCost)}</dd></div>
                                    <div className={`flex justify-between font-semibold ${totals.grossProfit < 0 ? "text-red-600" : "text-green-700"}`}>
                                        <dt>Gross profit</dt><dd className="tabular-nums">{money(totals.grossProfit)} · {totals.grossMarginPercent}%</dd>
                                    </div>
                                </div>
                            )}
                            {doc.amountPaid > 0 && (
                                <div className="pt-2 mt-2 border-t border-slate-200 space-y-1">
                                    <div className="flex justify-between text-slate-500"><dt>Paid</dt><dd className="tabular-nums">{money(doc.amountPaid)}</dd></div>
                                    <div className="flex justify-between font-semibold"><dt>Due</dt><dd className="tabular-nums">{money(Math.max(doc.total - doc.amountPaid, 0))}</dd></div>
                                </div>
                            )}
                        </dl>
                    </div>
                </section>
            </div>
        </form>
    );
}
