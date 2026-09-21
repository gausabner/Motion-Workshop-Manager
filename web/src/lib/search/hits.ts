import type { PickerHit, VehicleHit } from "@/lib/search/types";

/**
 * How records appear in a picker. Shared by the search actions and by pages
 * that preselect a value — a "use server" module may only export async
 * functions, so these cannot live there.
 */

/** "Farrell, Courtney" over their mobile, or their email when there is no mobile. */
export function customerHit(c: { id: string; firstName: string; lastName: string; mobile?: string | null; email?: string | null }): PickerHit {
    return { id: c.id, label: `${c.lastName}, ${c.firstName}`, sublabel: c.mobile ?? c.email ?? null };
}

/** The plate over "2021 Toyota Hilux · Farrell, Courtney". */
export function vehicleHit(v: {
    id: string; plate: string; make: string; model: string; year: number | null; customerId: string | null;
    customer: { firstName: string; lastName: string } | null;
}): VehicleHit {
    const owner = v.customer ? `${v.customer.lastName}, ${v.customer.firstName}` : null;
    const vehicle = [v.year, v.make, v.model].filter(Boolean).join(" ");
    return { id: v.id, label: v.plate, sublabel: owner ? `${vehicle} · ${owner}` : vehicle, customerId: v.customerId, ownerLabel: owner };
}
