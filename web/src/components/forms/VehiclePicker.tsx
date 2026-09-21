"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { EntityPicker } from "@/components/forms/EntityPicker";
import { QuickField, firstError } from "@/components/forms/QuickCreateFields";
import { quickCreateVehicle, searchVehicles } from "@/lib/search/actions";
import type { VehicleHit } from "@/lib/search/types";

type Props = {
    tenant: string;
    value: VehicleHit | null;
    onChange: (hit: VehicleHit | null) => void;
    /** Narrow the search to this customer's vehicles, and own anything created here. */
    customerId?: string | null;
    name?: string;
    label?: string;
    disabled?: boolean;
    error?: string;
    className?: string;
};

export function VehiclePicker({ tenant, customerId, name = "vehicleId", label = "Vehicle", ...rest }: Props) {
    const scope = customerId ?? null;
    const search = useCallback((q: string) => searchVehicles(tenant, q, scope), [tenant, scope]);
    return (
        <EntityPicker<VehicleHit>
            label={label}
            name={name}
            search={search}
            scopeKey={scope}
            placeholder={scope ? "This customer's vehicles — plate, VIN, make…" : "Plate, VIN, make or owner…"}
            createLabel="New vehicle"
            renderCreate={({ query, done, cancel }) => <QuickVehicle tenant={tenant} customerId={scope} query={query} done={done} cancel={cancel} />}
            {...rest}
        />
    );
}

function QuickVehicle({ tenant, customerId, query, done, cancel }: { tenant: string; customerId: string | null; query: string; done: (hit: VehicleHit) => void; cancel: () => void }) {
    const [form, setForm] = useState({ plate: query.trim().toUpperCase(), make: "", model: "" });
    const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
    const [message, setMessage] = useState<string>();
    const [pending, start] = useTransition();

    const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: key === "plate" ? value.toUpperCase() : value }));
    function submit() {
        start(async () => {
            const result = await quickCreateVehicle(tenant, { ...form, customerId });
            if (result.ok) done(result.hit);
            else {
                setErrors(result.errors ?? {});
                setMessage(result.message);
            }
        });
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">New vehicle</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <QuickField label="Plate number" value={form.plate} onChange={set("plate")} onEnter={submit} error={firstError(errors, "plate")} autoFocus={!form.plate} inputClassName="uppercase" />
                <QuickField label="Make" value={form.make} onChange={set("make")} onEnter={submit} error={firstError(errors, "make")} autoFocus={!!form.plate} />
                <QuickField label="Model" value={form.model} onChange={set("model")} onEnter={submit} error={firstError(errors, "model")} />
            </div>
            {message && !Object.keys(errors).length && <p className="text-xs text-red-600" role="alert">{message}</p>}
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-400">{customerId ? "Owned by this customer." : "No owner yet — set one on the vehicle page."} VIN, compliance and servicing can be added later.</p>
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
