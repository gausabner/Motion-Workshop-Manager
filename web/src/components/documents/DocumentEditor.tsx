"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextField, SelectField, CheckField } from "@/components/forms/fields";
import { Textarea } from "@/components/ui/textarea";
import { fieldClass } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldControl } from "@ui-sdk/react/field";
import { LineGrid, type EditorLine } from "@/components/documents/LineGrid";
import { CustomerPicker } from "@/components/forms/CustomerPicker";
import { VehiclePicker } from "@/components/forms/VehiclePicker";
import { customerHit, vehicleHit } from "@/lib/search/hits";
import type { PickerHit, VehicleHit } from "@/lib/search/types";
import { saveDocument } from "@/lib/documents/actions";
import { initialActionState, type ActionState } from "@/lib/forms";
import { calculateTotals } from "@/lib/documents/totals";
import { JOB_STATUS_LABELS, JOB_STATUS_ORDER } from "@/lib/documents/types";
import { dateInput, money } from "@/lib/format";
import { formatLocalDateTime } from "@/lib/diary/time";
import { setUnsaved, useUnsaved } from "@/lib/documents/unsaved";
import { useLeaveGuard } from "@/components/documents/useLeaveGuard";
import type { DocumentRecord, EditorOptions } from "@/lib/documents/queries";

type Props = {
    tenant: string;
    doc: DocumentRecord;
    options: EditorOptions;
    showCost: boolean;
    /** The workshop's zone: a booking time is shown as the workshop's wall clock, not the browser's. */
    timeZone: string;
};

function toEditorLines(doc: DocumentRecord): EditorLine[] {
    return doc.lines.map((l) => ({
        key: l.id,
        id: l.id,
        productId: l.productId,
        lineType: l.lineType,
        description: l.description,
        quantity: Number(l.quantity),
        hours: l.hours ?? null,
        unitPrice: Number(l.unitPrice),
        unitCost: Number(l.unitCost),
        vatRate: Number(l.vatRate),
        discountPercent: Number(l.discountPercent),
        serialNumbers: l.serialNumbers,
        isCustomerSupplied: l.isCustomerSupplied,
        bundleGroup: l.bundleGroup,
        bundleRole: l.bundleRole,
    }));
}


export function DocumentEditor({ tenant, doc, options, showCost, timeZone }: Props) {
    // Tax comes from the document's own snapshot, so a draft keeps the rate it was raised at.
    const pricesIncludeTax = doc.pricesIncludeTax;
    const taxRate = doc.taxRate;
    const readOnly = doc.state !== "DRAFT";
    // Counted before the action is defined, because the action reads them.
    const edits = useRef(0);
    const editsAtSave = useRef(0);
    // Cleared the moment the server answers that the save worked, not when the
    // refreshed page renders: in a production build that refresh can arrive
    // late or not at all on a document page, which would hold Process back
    // on a document that is already saved.
    const action = async (previous: ActionState, data: FormData) => {
        const answer = await saveDocument(tenant, doc.id, previous, data);
        if (answer.ok && edits.current === editsAtSave.current) setUnsaved(doc.id, false);
        return answer;
    };
    const [state, formAction, pending] = useActionState(action, initialActionState);
    const [lines, setLines] = useState<EditorLine[]>(() => toEditorLines(doc));
    const [customer, setCustomer] = useState<PickerHit | null>(() => (doc.customer ? customerHit(doc.customer) : null));
    const [vehicle, setVehicle] = useState<VehicleHit | null>(() => (doc.vehicle ? vehicleHit(doc.vehicle) : null));
    const [isCashSale, setIsCashSale] = useState(doc.isCashSale);
    const [discountPercent, setDiscountPercent] = useState(doc.discountPercent ?? 0);
    const [freight, setFreight] = useState(doc.freight ?? 0);
    const [estimatedHours, setEstimatedHours] = useState(doc.estimatedHours == null ? "" : String(doc.estimatedHours));
    const [service, setService] = useState("");
    const errors = state.errors;

    // What is on screen and what is saved can differ, and Process, Convert and
    // Copy act on what is saved; the toolbar reads this and waits. Unsaved
    // means the person has changed something since the last save that
    // succeeded. Edits are counted, so typing while a save is on its way keeps
    // the document unsaved; values the server fills in on save are not edits.
    const unsaved = useUnsaved(doc.id);
    const [, startSave] = useTransition();
    const touch = () => {
        if (readOnly) return;
        edits.current += 1;
        setUnsaved(doc.id, true);
    };
    const changeLines: typeof setLines = (next) => {
        setLines(next);
        touch();
    };
    useEffect(() => () => setUnsaved(doc.id, false), [doc.id]);
    useLeaveGuard(unsaved);

    const isJob = doc.type === "BOOKING" || doc.type === "JOB_CARD";
    const isFinancial = doc.type === "INVOICE" || doc.type === "CASH_SALE" || doc.type === "CREDIT";

    const totals = useMemo(
        () => calculateTotals({ lines, pricesIncludeTax, discountPercent: Number(discountPercent) || 0, freight: Number(freight) || 0, freightVatRate: taxRate }),
        [lines, pricesIncludeTax, discountPercent, freight, taxRate],
    );

    // A different customer drops a vehicle that isn't theirs.
    function chooseCustomer(hit: PickerHit | null) {
        if (hit?.id !== customer?.id) touch();
        setCustomer(hit);
        if (hit && vehicle?.customerId && vehicle.customerId !== hit.id) setVehicle(null);
    }

    // The counter usually starts from the plate, so choosing a vehicle first fills in its owner.
    function chooseVehicle(hit: VehicleHit | null) {
        if (hit?.id !== vehicle?.id) touch();
        setVehicle(hit);
        if (hit?.customerId && hit.ownerLabel && !customer) setCustomer({ id: hit.customerId, label: hit.ownerLabel, sublabel: null });
    }

    return (
        <form
            action={formAction}
            onInput={touch}
            // Saved by hand rather than through the action attribute: React resets
            // a form after a successful action, which put fields back to stale
            // defaults until the refreshed page arrived, and made a saved
            // document read as changed.
            onSubmit={(e) => {
                e.preventDefault();
                editsAtSave.current = edits.current;
                const data = new FormData(e.currentTarget);
                startSave(() => formAction(data));
            }}
            className="space-y-4"
        >
            {/* `key` is editor-only; JSON.stringify drops undefined, so it never reaches the server. */}
            <input type="hidden" name="lines" value={JSON.stringify(lines.map((line) => ({ ...line, key: undefined })))} />

            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-600">
                    {readOnly ? "Processed documents are read-only. Copy it or raise a credit note to make changes." : "Draft — nothing is posted until you process it."}
                </p>
                <div className="flex items-center gap-2">
                    <span role="status" className={`text-sm ${unsaved ? "font-medium text-slate-800" : "text-teal-700"}`}>
                        {unsaved ? "Unsaved changes. Save before you process." : state.ok && state.message ? state.message : ""}
                    </span>
                    {state.message && !state.ok && <span className="text-sm text-red-700" role="alert">{state.message}</span>}
                    {!readOnly && (
                        <Button type="submit" size="sm" className="bg-teal-700 hover:bg-teal-800" disabled={pending}>
                            <Save className="w-4 h-4 mr-1" />{pending ? "Saving…" : "Save"}
                        </Button>
                    )}
                </div>
            </div>

            {/* A processed document is a record, not a form: every field is
                disabled, so nothing invites a change that cannot be saved. */}
            <fieldset disabled={readOnly} className="min-w-0 space-y-4">
            <section className="border border-slate-200 rounded-sm bg-white">
                <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Details</h2>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <CustomerPicker
                        tenant={tenant}
                        value={customer}
                        onChange={chooseCustomer}
                        placeholder={isCashSale ? "Cash sale — no customer needed" : "Name, mobile, email or plate…"}
                        disabled={readOnly}
                        error={errors?.customerId?.[0]}
                        className="lg:col-span-2"
                    />
                    <VehiclePicker
                        tenant={tenant}
                        value={vehicle}
                        onChange={chooseVehicle}
                        customerId={customer?.id ?? null}
                        disabled={readOnly}
                        error={errors?.vehicleId?.[0]}
                        className="lg:col-span-2"
                    />
                    <TextField label="Reference" name="reference" defaultValue={doc.reference} errors={errors} />
                    <TextField label="Customer order no." name="customerOrderNumber" defaultValue={doc.customerOrderNumber} errors={errors} />
                    <SelectField label="Service advisor" name="serviceAdvisorId" defaultValue={doc.serviceAdvisorId} errors={errors} allowEmpty="—" options={options.advisors.map((a) => ({ value: a.id, label: a.name }))} />
                    <SelectField label="Mechanic" name="mechanicId" defaultValue={doc.mechanicId} errors={errors} allowEmpty="— unassigned —" options={options.mechanics.map((m) => ({ value: m.id, label: m.name }))} />
                    <TextField label="Post date" name="postDate" type="date" defaultValue={dateInput(doc.postDate)} errors={errors} />
                    {isFinancial && <TextField label="Due date" name="dueDate" type="date" defaultValue={dateInput(doc.dueDate)} errors={errors} hint="Leave blank to use the payment terms" />}
                    {doc.type === "QUOTE" && <TextField label="Follow up on" name="followUpDate" type="date" defaultValue={dateInput(doc.followUpDate)} errors={errors} />}
                    {isJob && <TextField label="Scheduled for" name="scheduledAt" type="datetime-local" defaultValue={formatLocalDateTime(doc.scheduledAt ? new Date(doc.scheduledAt) : null, timeZone)} errors={errors} />}
                    {isJob && !readOnly && options.services.length > 0 && (
                        <Field label="Service" name="service" errors={errors} hint="Fills the time — the same list online booking uses">
                            <FieldControl
                                render={<select />}
                                id="service" value={service}
                                onChange={(e) => {
                                    setService(e.target.value);
                                    const chosen = options.services.find((t) => t.id === e.target.value);
                                    if (chosen) setEstimatedHours(String(chosen.hours));
                                }}
                                className={cn(fieldClass, "h-8 px-2 text-sm")}
                            >
                                <option value="">Choose…</option>
                                {options.services.map((t) => <option key={t.id} value={t.id}>{t.description} ({t.hours}h)</option>)}
                            </FieldControl>
                        </Field>
                    )}
                    {/* Names the job until it has a line one to be named by. */}
                    {service && <input type="hidden" name="description" value={options.services.find((t) => t.id === service)?.description ?? ""} />}
                    {isJob && <TextField label="Estimated hours" name="estimatedHours" type="number" step="0.25" min="0" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} errors={errors} />}
                    <div className="lg:col-span-4 flex flex-wrap gap-6 pt-1">
                        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                            <input type="checkbox" name="isCashSale" defaultChecked={isCashSale} onChange={(e) => setIsCashSale(e.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-700" disabled={readOnly} />
                            <span>Cash sale<span className="block text-[11px] text-slate-500">No customer account</span></span>
                        </label>
                        <CheckField label="Internal job" name="isInternal" defaultChecked={doc.isInternal} hint="Excluded from sales reporting" />
                    </div>
                </div>
            </section>

            {isJob && (
                <section className="border border-slate-200 rounded-sm bg-white">
                    <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Job</h2>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                        <SelectField label="Status" name="jobStatus" defaultValue={doc.jobStatus ?? "BOOKED_IN"} errors={errors} options={JOB_STATUS_ORDER.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s] }))} />
                        <TextField label="Status comment" name="statusComment" defaultValue={doc.statusComment} errors={errors} className="lg:col-span-3" placeholder="e.g. waiting on brake pads from Midas" />
                    </div>
                </section>
            )}

            <section className="border border-slate-200 rounded-sm bg-white">
                <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Vehicle readings</h2>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
                    <TextField label="Odometer (km)" name="odometer" type="number" min="0" defaultValue={doc.odometer} errors={errors} hint="Saved to the vehicle record when processed" />
                    <TextField label="Next service at (km)" name="nextServiceKm" type="number" min="0" defaultValue={doc.nextServiceKm} errors={errors} />
                    <TextField label="Next service date" name="nextServiceDate" type="date" defaultValue={dateInput(doc.nextServiceDate)} errors={errors} />
                    <SelectField label="Payment terms" name="paymentTermsDays" defaultValue={doc.paymentTermsDays != null ? String(doc.paymentTermsDays) : ""} errors={errors} allowEmpty="Workshop default"
                        options={[{ value: "0", label: "Cash on delivery" }, { value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }]} />
                </div>
            </section>

            <LineGrid lines={lines} onChange={changeLines} products={options.products} pricesIncludeTax={pricesIncludeTax} taxRate={taxRate} showCost={showCost} readOnly={readOnly} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <section className="lg:col-span-2 border border-slate-200 rounded-sm bg-white">
                    <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes</h2>
                    <div className="p-4 space-y-3">
                        <Field label="Job card notes (workshop)" name="jobCardNotes" errors={errors}>
                            <Textarea id="jobCardNotes" name="jobCardNotes" defaultValue={doc.jobCardNotes ?? ""} rows={3} disabled={readOnly} className="text-sm" />
                        </Field>
                        <Field label="Notes on the printed document (customer)" name="invoiceNotes" errors={errors}>
                            <Textarea id="invoiceNotes" name="invoiceNotes" defaultValue={doc.invoiceNotes ?? ""} rows={3} disabled={readOnly} className="text-sm" />
                        </Field>
                    </div>
                </section>

                <section className="border border-slate-200 rounded-sm bg-white h-fit">
                    <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Totals</h2>
                    <div className="p-4 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <TextField label="Discount %" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} errors={errors} disabled={readOnly} />
                            <TextField label="Freight" name="freight" type="number" step="0.01" min="0" defaultValue={freight} onChange={(e) => setFreight(Number(e.target.value))} errors={errors} disabled={readOnly} />
                        </div>
                        <input type="hidden" name="discountAmount" value={0} />
                        <dl className="pt-2 space-y-1.5 border-t border-slate-100">
                            <div className="flex justify-between"><dt className="text-slate-500">Subtotal (excl. VAT)</dt><dd className="tabular-nums">{money(totals.subtotal)}</dd></div>
                            {totals.discountApplied > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd className="tabular-nums">− {money(totals.discountApplied)}</dd></div>}
                            <div className="flex justify-between"><dt className="text-slate-500">{doc.taxName} ({taxRate}%)</dt><dd className="tabular-nums">{money(totals.vatTotal)}</dd></div>
                            <div className="flex justify-between pt-1.5 border-t border-slate-200 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{money(totals.total)}</dd></div>
                        </dl>
                        {showCost && (
                            <dl className="pt-2 border-t border-dashed border-slate-200 space-y-1 text-xs">
                                <div className="flex justify-between text-slate-500"><dt>Cost</dt><dd className="tabular-nums">{money(totals.totalCost)}</dd></div>
                                <div className={`flex justify-between font-semibold ${totals.grossProfit < 0 ? "text-red-700" : "text-slate-800"}`}>
                                    <dt>Gross profit</dt><dd className="tabular-nums">{money(totals.grossProfit)} · {totals.grossMarginPercent}%</dd>
                                </div>
                            </dl>
                        )}
                        {doc.amountPaid > 0 && (
                            <dl className="pt-2 border-t border-slate-200 space-y-1">
                                <div className="flex justify-between text-slate-500"><dt>Paid</dt><dd className="tabular-nums">{money(doc.amountPaid)}</dd></div>
                                <div className="flex justify-between font-semibold"><dt>Due</dt><dd className="tabular-nums">{money(doc.amountDue)}</dd></div>
                            </dl>
                        )}
                        <p className="pt-1 text-[11px] text-slate-500">
                            Prices {pricesIncludeTax ? "include" : "exclude"} {doc.taxName} at {taxRate}% — fixed when this document was raised.
                        </p>
                    </div>
                </section>
            </div>
            </fieldset>
        </form>
    );
}
