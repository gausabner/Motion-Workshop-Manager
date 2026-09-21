"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Section, TextField } from "@/components/forms/fields";
import { initialActionState } from "@/lib/forms";
import { removeLogo, saveCompanySettings, uploadLogo } from "@/lib/settings/actions";

export type CompanyProfile = {
    name: string;
    registrationNumber: string | null;
    vatNumber: string | null;
    address1: string | null;
    address2: string | null;
    suburb: string | null;
    city: string | null;
    region: string | null;
    postcode: string | null;
    country: string;
    phone: string | null;
    mobile: string | null;
    whatsapp: string | null;
    email: string | null;
    web: string | null;
    timezone: string;
    currency: string;
    bankDetails: string;
    logoAttachmentId?: string;
};

/**
 * What the customer sees on every document. This is the letterhead, so the
 * fields are exactly the ones that get printed — nothing here is decorative.
 */
export function CompanySettingsForm({ tenant, profile }: { tenant: string; profile: CompanyProfile }) {
    const [state, formAction, saving] = useActionState(saveCompanySettings.bind(null, tenant), initialActionState);
    const errors = state.errors;

    return (
        <form action={formAction} className="space-y-4 max-w-5xl pb-12">
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-500">These details head every quote, invoice, receipt and statement that leaves the workshop.</p>
                <div className="flex items-center gap-3">
                    {state.message && <span className={state.ok ? "text-sm text-teal-700" : "text-sm text-red-600"} role={state.ok ? undefined : "alert"}>{state.message}</span>}
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>
                        <Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            <LogoPanel tenant={tenant} logoAttachmentId={profile.logoAttachmentId} />

            <Section title="Workshop">
                <TextField label="Trading name" name="name" errors={errors} defaultValue={profile.name} className="lg:col-span-2" required />
                <TextField label="Registration number" name="registrationNumber" errors={errors} defaultValue={profile.registrationNumber} />
                <TextField label="VAT number" name="vatNumber" errors={errors} defaultValue={profile.vatNumber} hint="Printed on every tax invoice" />
            </Section>

            <Section title="Address">
                <TextField label="Street" name="address1" errors={errors} defaultValue={profile.address1} className="lg:col-span-2" />
                <TextField label="Street (line 2)" name="address2" errors={errors} defaultValue={profile.address2} className="lg:col-span-2" />
                <TextField label="Suburb" name="suburb" errors={errors} defaultValue={profile.suburb} />
                <TextField label="Town / city" name="city" errors={errors} defaultValue={profile.city} />
                <TextField label="Region" name="region" errors={errors} defaultValue={profile.region} />
                <TextField label="Postcode" name="postcode" errors={errors} defaultValue={profile.postcode} />
            </Section>

            <Section title="Contact">
                <TextField label="Phone" name="phone" type="tel" errors={errors} defaultValue={profile.phone} />
                <TextField label="Mobile" name="mobile" type="tel" errors={errors} defaultValue={profile.mobile} />
                <TextField label="WhatsApp" name="whatsapp" type="tel" errors={errors} defaultValue={profile.whatsapp} hint="Used for sending documents" />
                <TextField label="Email" name="email" type="email" errors={errors} defaultValue={profile.email} />
                <TextField label="Website" name="web" errors={errors} defaultValue={profile.web} className="lg:col-span-2" />
            </Section>

            <Section title="Locale">
                <TextField label="Timezone" name="timezone" errors={errors} defaultValue={profile.timezone} hint="Decides which day a receipt is booked to" />
                <TextField label="Currency" name="currency" errors={errors} defaultValue={profile.currency} maxLength={3} hint="NAD or ZAR" />
                <input type="hidden" name="country" value={profile.country} />
            </Section>

            <section className="border border-slate-200 rounded-sm bg-white">
                <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Banking details</h3>
                <div className="p-4">
                    <Field label="Printed in the invoice footer" name="bankDetails" errors={errors} hint="Whatever your bank wants quoted — branch, account number, reference.">
                        <textarea
                            id="bankDetails" name="bankDetails" rows={3} defaultValue={profile.bankDetails}
                            className="w-full rounded-md border border-input bg-white px-2 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                        />
                    </Field>
                </div>
            </section>
        </form>
    );
}

/**
 * The logo is uploaded on its own rather than with the form, because it goes
 * through the storage layer and the rest of this page is a plain row update.
 */
function LogoPanel({ tenant, logoAttachmentId }: { tenant: string; logoAttachmentId?: string }) {
    const input = useRef<HTMLInputElement>(null);
    const [state, setState] = useState<{ message?: string; ok?: boolean }>({});
    const [pending, start] = useTransition();
    const [logo, setLogo] = useState(logoAttachmentId);

    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <h3 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Letterhead logo</h3>
            <div className="p-4 flex flex-wrap items-center gap-4">
                {logo ? (
                    <Image src={`/${tenant}/attachments/${logo}`} alt="Workshop logo" width={160} height={64} unoptimized className="h-16 w-auto max-w-[160px] object-contain border border-slate-200 rounded-sm bg-white p-1" />
                ) : (
                    <div className="h-16 w-40 border border-dashed border-slate-300 rounded-sm grid place-items-center text-[11px] text-slate-400">No logo</div>
                )}
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        {/* Deliberately outside the profile form: a nested form is not allowed, and this posts on its own. */}
                        <input
                            ref={input} type="file" className="hidden" accept="image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                start(async () => {
                                    const body = new FormData();
                                    body.set("file", file);
                                    setState(await uploadLogo(tenant, {}, body));
                                });
                            }}
                        />
                        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => input.current?.click()}>
                            {pending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                            {logo ? "Replace" : "Upload"}
                        </Button>
                        {logo && (
                            <Button
                                type="button" size="sm" variant="ghost" className="text-slate-500 hover:text-red-700"
                                onClick={() => start(async () => { await removeLogo(tenant); setLogo(undefined); setState({}); })}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />Remove
                            </Button>
                        )}
                    </div>
                    <p className="text-[11px] text-slate-400">PNG or JPEG, landscape. It is printed at about 40 mm wide.</p>
                    {state.message && <p className={`text-xs ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</p>}
                </div>
            </div>
        </section>
    );
}
