"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextField, SelectField, CheckField, Section } from "@/components/forms/fields";
import { CustomerPicker } from "@/components/forms/CustomerPicker";
import type { PickerHit } from "@/lib/search/types";
import { saveVehicle } from "@/lib/vehicles/actions";
import { initialActionState } from "@/lib/forms";
import { dateInput } from "@/lib/format";
import { DRIVE_TYPES, FUEL_TYPES, TRANSMISSIONS, VEHICLE_GROUPS } from "@/lib/vehicles/schema";
import type { VehicleRecord } from "@/lib/vehicles/queries";

type Props = {
    tenant: string;
    vehicle?: VehicleRecord | null;
    /** The owner to preselect: the vehicle's current owner, or the customer it is being added for. */
    initialOwner?: PickerHit | null;
};

const opts = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

export function VehicleForm({ tenant, vehicle, initialOwner }: Props) {
    const action = saveVehicle.bind(null, tenant, vehicle?.id ?? null);
    const [state, formAction, pending] = useActionState(action, initialActionState);
    const [advanced, setAdvanced] = useState(!!(vehicle?.engineNumber || vehicle?.chassisNumber || vehicle?.keyCode || vehicle?.radioPin));
    const [owner, setOwner] = useState<PickerHit | null>(initialOwner ?? null);
    const v = vehicle;
    const errors = state.errors;

    return (
        <form action={formAction} style={{ paddingBottom: "calc(calc(57px + env(safe-area-inset-bottom, 0px)) + 5rem)" }} className="mx-auto max-w-7xl space-y-4 sm:!pb-12">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{v ? "Edit vehicle" : "New vehicle"}</p>
                {/* The message stays outside the block that hides on a phone. It
                    was inside it, which would have meant a failed save showing
                    nothing at all on the device most likely to have a flaky
                    connection. */}
                {state.message && !state.ok && <span className="text-sm text-red-600 sm:hidden" role="alert">{state.message}</span>}
                <div className="hidden items-center gap-2 sm:flex">
                    {state.message && !state.ok && <span className="text-sm text-red-600" role="alert">{state.message}</span>}
                    <Button asChild variant="outline" size="sm"><Link href={`/${tenant}/dashboard/vehicles`}>Cancel</Link></Button>
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={pending}>
                        <Save className="w-4 h-4 mr-1" /> {pending ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            <Section title="Vehicle">
                <CustomerPicker tenant={tenant} name="customerId" label="Owner" value={owner} onChange={setOwner} error={errors?.customerId?.[0]} className="lg:col-span-2" />
                <TextField label="Plate number" name="plate" defaultValue={v?.plate} errors={errors} required autoFocus={!v} placeholder="N 12345 W" />
                <TextField label="VIN" name="vin" defaultValue={v?.vin} errors={errors} maxLength={17} hint="17 characters" />
                <TextField label="Make" name="make" defaultValue={v?.make} errors={errors} required />
                <TextField label="Model" name="model" defaultValue={v?.model} errors={errors} required />
                <TextField label="Series / variant" name="modelSeries" defaultValue={v?.modelSeries} errors={errors} />
                <TextField label="Year" name="year" type="number" min="1950" max={new Date().getFullYear() + 1} defaultValue={v?.year} errors={errors} />
                <SelectField label="Vehicle group" name="vehicleGroup" defaultValue={v?.vehicleGroup} errors={errors} allowEmpty="—" options={opts(VEHICLE_GROUPS)} />
                <SelectField label="Fuel" name="fuelType" defaultValue={v?.fuelType} errors={errors} allowEmpty="—" options={opts(FUEL_TYPES)} />
                <SelectField label="Transmission" name="transmission" defaultValue={v?.transmission} errors={errors} allowEmpty="—" options={opts(TRANSMISSIONS)} />
                <TextField label="Colour" name="colour" defaultValue={v?.colour} errors={errors} />
                <TextField label="Fleet code" name="fleetCode" defaultValue={v?.fleetCode} errors={errors} />
            </Section>

            <Section title="Compliance & servicing">
                <TextField label="Odometer (km)" name="odometer" type="number" min="0" defaultValue={v?.odometer} errors={errors} />
                <TextField label="Licence disc expires" name="licenceExpiry" type="date" defaultValue={dateInput(v?.licenceExpiry)} errors={errors} />
                <TextField label="Roadworthy expires" name="roadworthyExpiry" type="date" defaultValue={dateInput(v?.roadworthyExpiry)} errors={errors} hint="Blank if not required" />
                <TextField label="Service interval (months)" name="serviceIntervalMonths" type="number" min="0" defaultValue={v?.serviceIntervalMonths} errors={errors} />
                <TextField label="Last service" name="lastServiceDate" type="date" defaultValue={dateInput(v?.lastServiceDate)} errors={errors} />
                <TextField label="Next service due" name="nextServiceDate" type="date" defaultValue={dateInput(v?.nextServiceDate)} errors={errors} />
                <TextField label="Next service at (km)" name="nextServiceKm" type="number" min="0" defaultValue={v?.nextServiceKm} errors={errors} />
                <TextField label="Engine hours" name="engineHours" type="number" step="0.1" min="0" defaultValue={v?.engineHours} errors={errors} hint="Plant & marine" />
            </Section>

            <div className="flex items-center gap-2">
                <input id="advanced" type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} className="h-4 w-4 accent-teal-600" />
                <label htmlFor="advanced" className="text-sm text-slate-600 cursor-pointer">Show advanced vehicle fields</label>
            </div>

            <Section title="Advanced" className={advanced ? "" : "hidden"}>
                <TextField label="Engine number" name="engineNumber" defaultValue={v?.engineNumber} errors={errors} />
                <TextField label="Chassis number" name="chassisNumber" defaultValue={v?.chassisNumber} errors={errors} />
                <TextField label="Engine code" name="engineCode" defaultValue={v?.engineCode} errors={errors} />
                <TextField label="Body type" name="bodyType" defaultValue={v?.bodyType} errors={errors} />
                <SelectField label="Drive" name="driveType" defaultValue={v?.driveType} errors={errors} allowEmpty="—" options={opts(DRIVE_TYPES)} />
                <TextField label="Cylinders" name="cylinders" type="number" min="0" defaultValue={v?.cylinders} errors={errors} />
                <TextField label="Engine size (L)" name="litres" type="number" step="0.1" min="0" defaultValue={v?.litres} errors={errors} />
                <TextField label="Seats" name="seating" type="number" min="0" defaultValue={v?.seating} errors={errors} />
                <TextField label="Tyre size" name="tyreSize" defaultValue={v?.tyreSize} errors={errors} placeholder="265/65 R17" />
                <TextField label="Key code" name="keyCode" defaultValue={v?.keyCode} errors={errors} />
                <TextField label="Radio PIN" name="radioPin" defaultValue={v?.radioPin} errors={errors} />
                <div className="pt-5"><CheckField label="Air conditioning" name="hasAc" defaultChecked={v?.hasAc} /></div>
            </Section>

            <Section title="Notes">
                <Field label="Vehicle note" name="note" errors={errors} className="lg:col-span-4">
                    <textarea id="note" name="note" defaultValue={v?.note ?? ""} rows={3} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500" />
                </Field>
            </Section>

            {/* On a phone the buttons above scroll away the moment someone starts
                filling the form, and Save is the one control they want at the end
                rather than the beginning.

                Fixed rather than sticky, and offset by exactly the tab bar's
                height. Sticky was wrong: inside a scroll container that carries
                its own bottom padding it anchors to the padded edge, not to the
                bar, which left a 67px strip of scrolling page showing between the
                two. Fixed positions against the viewport, so the two bars meet. */}
            <div
                /* 57px is MobileNav: a 56px touch target (h-14) plus its 1px top border. */
                style={{ bottom: "calc(57px + env(safe-area-inset-bottom, 0px))" }}
                className="fixed inset-x-0 z-30 flex gap-2 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-2px_10px_rgba(15,23,42,.06)] sm:hidden"
            >
                <Button asChild variant="outline" className="h-12 flex-1"><Link href={`/${tenant}/dashboard/vehicles`}>Cancel</Link></Button>
                <Button type="submit" className="h-12 flex-[2] bg-teal-600 hover:bg-teal-700" disabled={pending}>
                    <Save className="mr-1 h-4 w-4" /> {pending ? "Saving…" : "Save"}
                </Button>
            </div>
        </form>
    );
}
