"use client";

import { useFormStatus } from "react-dom";
import { CalendarPlus, FilePlus2, Receipt, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDocument } from "@/lib/documents/actions";

const KINDS = [
    { type: "BOOKING", label: "Booking", icon: CalendarPlus },
    { type: "QUOTE", label: "Quote", icon: FilePlus2 },
    { type: "JOB_CARD", label: "Job card", icon: Wrench },
    { type: "INVOICE", label: "Invoice", icon: Receipt },
] as const;

/**
 * Disabled the moment it is pressed.
 *
 * `createDocument` makes a document every time it is called, so two taps make
 * two documents — and removing the 300ms tap delay for the phone work made a
 * double tap register as two clicks rather than one. The button that started
 * the work is the right place to stop the second press, because by the time
 * the server sees it the two requests are indistinguishable.
 */
function Create({ label, icon: Icon }: { label: string; icon: typeof Wrench }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="sm" variant="outline" className="h-8" disabled={pending}>
            <Icon className="w-3.5 h-3.5 mr-1" />{label}
        </Button>
    );
}

export function NewDocumentButtons({ tenant, seed }: { tenant: string; seed?: { customerId?: string; vehicleId?: string } }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {KINDS.map((k) => (
                <form key={k.type} action={createDocument.bind(null, tenant, k.type, seed)}>
                    <Create label={k.label} icon={k.icon} />
                </form>
            ))}
        </div>
    );
}
