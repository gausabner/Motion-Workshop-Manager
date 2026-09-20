"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { archiveSupplier, saveSupplier } from "@/lib/suppliers/actions";

export type SupplierRecord = {
    id: string; companyName: string; accountNumber: string | null; vatNumber: string | null; address1: string | null;
    suburb: string | null; city: string | null; postcode: string | null; phone: string | null; mobile: string | null;
    email: string | null; web: string | null; paymentTermsDays: number | null; note: string | null; archivedAt: Date | null;
};

const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm";

function Text({ label, name, defaultValue, errors, type = "text" }: { label: string; name: string; defaultValue?: string | number | null; errors?: string[]; type?: string }) {
    return (
        <label className="block space-y-1 text-sm">
            <span className="text-slate-600">{label}</span>
            <input name={name} type={type} defaultValue={defaultValue ?? ""} className={field} />
            {errors && <span className="block text-xs text-red-600">{errors[0]}</span>}
        </label>
    );
}

export function SupplierForm({ tenant, supplier }: { tenant: string; supplier: SupplierRecord | null }) {
    const [state, action, saving] = useActionState(saveSupplier.bind(null, tenant, supplier?.id ?? null), initialActionState);
    const [archiving, startArchive] = useTransition();
    const e = state.errors;
    return (
        <form action={action} className="space-y-4">
            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Text label="Supplier name" name="companyName" defaultValue={supplier?.companyName} errors={e?.companyName} />
                    <Text label="Our account number with them" name="accountNumber" defaultValue={supplier?.accountNumber} />
                    <Text label="VAT number" name="vatNumber" defaultValue={supplier?.vatNumber} />
                    <Text label="Phone" name="phone" defaultValue={supplier?.phone} />
                    <Text label="Mobile" name="mobile" defaultValue={supplier?.mobile} />
                    <Text label="Email" name="email" defaultValue={supplier?.email} errors={e?.email} />
                    <Text label="Street" name="address1" defaultValue={supplier?.address1} />
                    <Text label="Suburb" name="suburb" defaultValue={supplier?.suburb} />
                    <Text label="Town" name="city" defaultValue={supplier?.city} />
                    <Text label="Postcode" name="postcode" defaultValue={supplier?.postcode} />
                    <Text label="Website" name="web" defaultValue={supplier?.web} />
                    <Text label="Their payment terms (days)" name="paymentTermsDays" defaultValue={supplier?.paymentTermsDays} />
                    <label className="block space-y-1 text-sm sm:col-span-2 lg:col-span-3">
                        <span className="text-slate-600">Note</span>
                        <input name="note" defaultValue={supplier?.note ?? ""} className={field} />
                    </label>
                </div>
            </section>
            <div className="flex items-center gap-3">
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>{saving ? "Saving…" : supplier ? "Save" : "Add supplier"}</Button>
                {supplier && (
                    <Button type="button" size="sm" variant="outline" disabled={archiving} onClick={() => startArchive(() => archiveSupplier(tenant, supplier.id, !supplier.archivedAt))}>
                        {supplier.archivedAt ? "Put back on the list" : "Archive"}
                    </Button>
                )}
                {state.message && <p className={`text-sm ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</p>}
            </div>
        </form>
    );
}
