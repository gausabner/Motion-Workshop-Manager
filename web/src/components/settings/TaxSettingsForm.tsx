"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckField, Section, TextField } from "@/components/forms/fields";
import { initialActionState } from "@/lib/forms";
import { saveTaxSettings } from "@/lib/settings/actions";

export type TaxProfile = {
    taxName: string;
    salesTaxRate: number;
    purchaseTaxRate: number;
    pricesIncludeTax: boolean;
    defaultPaymentTermsDays: number;
};

/**
 * Tax defaults for documents raised from now on.
 *
 * The warning is the important part of this screen: every document carries the
 * rate it was raised at, so changing this does not — and must not — rewrite a
 * single invoice already on the books.
 */
export function TaxSettingsForm({ tenant, tax }: { tenant: string; tax: TaxProfile }) {
    const [state, formAction, saving] = useActionState(saveTaxSettings.bind(null, tenant), initialActionState);
    const errors = state.errors;

    return (
        <form action={formAction} className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-500">Applies to documents raised from now on.</p>
                <div className="flex items-center gap-3">
                    {state.message && <span className={state.ok ? "text-sm text-teal-700" : "text-sm text-red-600"} role={state.ok ? undefined : "alert"}>{state.message}</span>}
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
                        <Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            <Section title="Tax">
                <TextField label="Tax name" name="taxName" errors={errors} defaultValue={tax.taxName} hint="Printed on the document, e.g. VAT" />
                <TextField label="Sales tax rate (%)" name="salesTaxRate" type="number" step="0.01" errors={errors} defaultValue={tax.salesTaxRate} />
                <TextField label="Purchase tax rate (%)" name="purchaseTaxRate" type="number" step="0.01" errors={errors} defaultValue={tax.purchaseTaxRate} />
                <TextField label="Default payment terms (days)" name="defaultPaymentTermsDays" type="number" errors={errors} defaultValue={tax.defaultPaymentTermsDays} hint="0 means due on receipt" />
                <div className="lg:col-span-4 pt-1">
                    <CheckField
                        label="Prices already include tax"
                        name="pricesIncludeTax"
                        defaultChecked={tax.pricesIncludeTax}
                        hint="How Namibian and South African workshops normally quote: the shelf price is what the customer pays."
                    />
                </div>
            </Section>

            <p className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                Changing the rate never rewrites history. Every quote, invoice and credit note keeps the rate it was raised at, so last
                year&rsquo;s invoices still add up to what the customer actually paid.
            </p>
        </form>
    );
}
