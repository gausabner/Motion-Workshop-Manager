"use client";

import { CalendarPlus, FilePlus2, Receipt, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDocument } from "@/lib/documents/actions";

const KINDS = [
    { type: "BOOKING", label: "Booking", icon: CalendarPlus },
    { type: "QUOTE", label: "Quote", icon: FilePlus2 },
    { type: "JOB_CARD", label: "Job card", icon: Wrench },
    { type: "INVOICE", label: "Invoice", icon: Receipt },
] as const;

export function NewDocumentButtons({ tenant, seed }: { tenant: string; seed?: { customerId?: string; vehicleId?: string } }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {KINDS.map((k) => (
                <form key={k.type} action={createDocument.bind(null, tenant, k.type, seed)}>
                    <Button type="submit" size="sm" variant="outline" className="h-8">
                        <k.icon className="w-3.5 h-3.5 mr-1" />{k.label}
                    </Button>
                </form>
            ))}
        </div>
    );
}
