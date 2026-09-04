"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { Save, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, TextField, SelectField, CheckField, Section } from "@/components/forms/fields";
import { saveCustomer } from "@/lib/customers/actions";
import { initialActionState } from "@/lib/forms";
import type { CustomerRecord } from "@/lib/customers/queries";

const REGIONS = ["Khomas", "Erongo", "Oshana", "Otjozondjupa", "Hardap", "ǁKaras", "Kunene", "Omaheke", "Omusati", "Ohangwena", "Oshikoto", "Kavango East", "Kavango West", "Zambezi"];

type Props = {
    tenant: string;
    customer?: CustomerRecord | null;
    sources: { id: string; name: string }[];
};

export function CustomerForm({ tenant, customer, sources }: Props) {
    const action = saveCustomer.bind(null, tenant, customer?.id ?? null);
    const [state, formAction, pending] = useActionState(action, initialActionState);
    const formRef = useRef<HTMLFormElement>(null);
    const c = customer;
    const errors = state.errors;

    function copyStreetToPostal() {
        const f = formRef.current;
        if (!f) return;
        for (const k of ["Address1", "Address2", "Suburb", "City", "Region", "Country", "Postcode"]) {
            const from = f.elements.namedItem(`street${k}`) as HTMLInputElement | HTMLSelectElement | null;
            const to = f.elements.namedItem(`postal${k}`) as HTMLInputElement | HTMLSelectElement | null;
            if (from && to) to.value = from.value;
        }
    }

    return (
        <form ref={formRef} action={formAction} className="space-y-4 max-w-7xl mx-auto pb-12">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{c ? "Edit customer" : "New customer"}</p>
                <div className="flex items-center gap-2">
                    {state.message && !state.ok && <span className="text-sm text-red-600" role="alert">{state.message}</span>}
                    <Button asChild variant="outline" size="sm"><Link href={`/${tenant}/dashboard/customers`}>Cancel</Link></Button>
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={pending}>
                        <Save className="w-4 h-4 mr-1" /> {pending ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            <Section title="Customer">
                <TextField label="First name" name="firstName" defaultValue={c?.firstName} errors={errors} required autoFocus={!c} />
                <TextField label="Last name / company" name="lastName" defaultValue={c?.lastName} errors={errors} required />
                <TextField label="Business registration no." name="businessNumber" defaultValue={c?.businessNumber} errors={errors} />
                <TextField label="VAT number" name="vatNumber" defaultValue={c?.vatNumber} errors={errors} />
                <div className="lg:col-span-4 flex flex-wrap gap-6 pt-1">
                    <CheckField label="Business / fleet account" name="isBusiness" defaultChecked={c?.isBusiness} hint="Order numbers required on invoices" />
                    <CheckField label="VAT exempt" name="vatExempt" defaultChecked={c?.vatExempt} />
                </div>
            </Section>

            <Section title="Contact">
                <TextField label="Mobile (WhatsApp)" name="mobile" type="tel" defaultValue={c?.mobile} errors={errors} placeholder="+264 81 …" />
                <TextField label="Phone" name="phone" type="tel" defaultValue={c?.phone} errors={errors} />
                <TextField label="Email" name="email" type="email" defaultValue={c?.email} errors={errors} />
                <SelectField label="Preferred contact" name="preferredContact" defaultValue={c?.preferredContact ?? "WHATSAPP"} errors={errors}
                    options={[{ value: "WHATSAPP", label: "WhatsApp" }, { value: "SMS", label: "SMS" }, { value: "EMAIL", label: "Email" }, { value: "OPT_OUT", label: "Opted out of messages" }]} />
                <TextField label="Fax" name="fax" defaultValue={c?.fax} errors={errors} />
                <TextField label="Website" name="web" defaultValue={c?.web} errors={errors} />
                <SelectField label="Customer source" name="customerSourceId" defaultValue={c?.customerSourceId} errors={errors} allowEmpty="—" options={sources.map((s) => ({ value: s.id, label: s.name }))} />
            </Section>

            <Section title="Street address">
                <TextField label="Address 1" name="streetAddress1" defaultValue={c?.streetAddress1} errors={errors} className="lg:col-span-2" />
                <TextField label="Address 2" name="streetAddress2" defaultValue={c?.streetAddress2} errors={errors} className="lg:col-span-2" />
                <TextField label="Suburb" name="streetSuburb" defaultValue={c?.streetSuburb} errors={errors} />
                <TextField label="City / town" name="streetCity" defaultValue={c?.streetCity ?? (c ? "" : "Windhoek")} errors={errors} />
                <SelectField label="Region" name="streetRegion" defaultValue={c?.streetRegion ?? (c ? "" : "Khomas")} errors={errors} allowEmpty="—" options={REGIONS.map((r) => ({ value: r, label: r }))} />
                <TextField label="Postcode" name="streetPostcode" defaultValue={c?.streetPostcode} errors={errors} />
                <input type="hidden" name="streetCountry" value={c?.streetCountry ?? "NA"} />
            </Section>

            <Section title="Postal address">
                <div className="lg:col-span-4 -mt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={copyStreetToPostal} className="text-teal-700 h-7 px-2"><ArrowDownToLine className="w-3.5 h-3.5 mr-1" />Same as street address</Button>
                </div>
                <TextField label="Address 1" name="postalAddress1" defaultValue={c?.postalAddress1} errors={errors} className="lg:col-span-2" />
                <TextField label="Address 2" name="postalAddress2" defaultValue={c?.postalAddress2} errors={errors} className="lg:col-span-2" />
                <TextField label="Suburb" name="postalSuburb" defaultValue={c?.postalSuburb} errors={errors} />
                <TextField label="City / town" name="postalCity" defaultValue={c?.postalCity} errors={errors} />
                <SelectField label="Region" name="postalRegion" defaultValue={c?.postalRegion} errors={errors} allowEmpty="—" options={REGIONS.map((r) => ({ value: r, label: r }))} />
                <TextField label="Postcode" name="postalPostcode" defaultValue={c?.postalPostcode} errors={errors} />
                <input type="hidden" name="postalCountry" value={c?.postalCountry ?? "NA"} />
            </Section>

            <Section title="Pricing & terms">
                <SelectField label="Price level" name="priceType" defaultValue={c?.priceType ?? "RETAIL"} errors={errors}
                    options={[{ value: "RETAIL", label: "Retail" }, { value: "PRICE2", label: "Price 2" }, { value: "PRICE3", label: "Price 3" }, { value: "PRICE4", label: "Price 4" }]} />
                <TextField label="Hourly rate override (N$)" name="hourlyRate" type="number" step="0.01" min="0" defaultValue={c?.hourlyRate} errors={errors} hint="Blank = workshop default" />
                <TextField label="Discount %" name="discountPercent" type="number" step="0.01" min="0" max="100" defaultValue={c?.discountPercent ?? 0} errors={errors} />
                <TextField label="Markup %" name="markupPercent" type="number" step="0.01" min="0" defaultValue={c?.markupPercent ?? 0} errors={errors} />
                <SelectField label="Payment terms" name="paymentTermsDays" defaultValue={c?.paymentTermsDays != null ? String(c.paymentTermsDays) : ""} errors={errors} allowEmpty="Workshop default"
                    options={[{ value: "0", label: "Cash on delivery" }, { value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }]} />
                <TextField label="Credit limit (N$)" name="creditLimit" type="number" step="0.01" min="0" defaultValue={c?.creditLimit} errors={errors} />
            </Section>

            <Section title="Notes">
                <Field label="Internal note" name="note" errors={errors} className="lg:col-span-4">
                    <textarea id="note" name="note" defaultValue={c?.note ?? ""} rows={3} className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500" />
                </Field>
            </Section>
        </form>
    );
}
