"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EntityPicker } from "@/components/forms/EntityPicker";
import { QuickField, firstError } from "@/components/forms/QuickCreateFields";
import { quickCreateCustomer, searchCustomers } from "@/lib/search/actions";
import type { PickerHit } from "@/lib/search/types";

type Props = {
    tenant: string;
    value: PickerHit | null;
    onChange: (hit: PickerHit | null) => void;
    name?: string;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    className?: string;
};

export function CustomerPicker({ tenant, name = "customerId", label = "Customer", placeholder = "Name, mobile, email or plate…", ...rest }: Props) {
    const search = useCallback((q: string) => searchCustomers(tenant, q), [tenant]);
    return (
        <EntityPicker<PickerHit>
            label={label}
            name={name}
            search={search}
            placeholder={placeholder}
            createLabel="New customer"
            renderCreate={({ query, done, cancel }) => <QuickCustomer tenant={tenant} query={query} done={done} cancel={cancel} />}
            {...rest}
        />
    );
}

/** Prefill from what was typed: a phone number goes to mobile, words become first and last name. */
function prefill(query: string) {
    const q = query.trim();
    if (/^[+\d][\d\s-]{5,}$/.test(q)) return { firstName: "", lastName: "", mobile: q, email: "" };
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length < 2) return { firstName: words[0] ?? "", lastName: "", mobile: "", email: "" };
    return { firstName: words.slice(0, -1).join(" "), lastName: words[words.length - 1], mobile: "", email: "" };
}

function QuickCustomer({ tenant, query, done, cancel }: { tenant: string; query: string; done: (hit: PickerHit) => void; cancel: () => void }) {
    const [form, setForm] = useState(() => prefill(query));
    const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
    const [message, setMessage] = useState<string>();
    const [pending, start] = useTransition();

    const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
    function submit() {
        start(async () => {
            const result = await quickCreateCustomer(tenant, form);
            if (result.ok) done(result.hit);
            else {
                setErrors(result.errors ?? {});
                setMessage(result.message);
            }
        });
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">New customer</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <QuickField label="First name" value={form.firstName} onChange={set("firstName")} onEnter={submit} error={firstError(errors, "firstName")} autoFocus={!form.firstName} />
                <QuickField label="Last name / company" value={form.lastName} onChange={set("lastName")} onEnter={submit} error={firstError(errors, "lastName")} autoFocus={!!form.firstName && !form.lastName} />
                <QuickField label="Mobile (WhatsApp)" type="tel" value={form.mobile} onChange={set("mobile")} onEnter={submit} error={firstError(errors, "mobile")} />
                <QuickField label="Email" type="email" value={form.email} onChange={set("email")} onEnter={submit} error={firstError(errors, "email")} />
            </div>
            {message && !Object.keys(errors).length && <p className="text-xs text-red-600" role="alert">{message}</p>}
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">Address, pricing and terms can be added on the customer page later.</p>
                <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
                    <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={submit} disabled={pending}>
                        {pending ? "Creating…" : "Create and select"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
