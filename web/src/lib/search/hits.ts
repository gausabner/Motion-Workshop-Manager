import type { PickerHit, VehicleHit } from "@/lib/search/types";

/**
 * How records appear in a picker. Shared by the search actions and by pages
 * that preselect a value — a "use server" module may only export async
 * functions, so these cannot live there.
 */

/**
 * "Farrell, Courtney", surname first as a card index files people. A business
 * or a council department kept as one name ("City Police") has no surname,
 * so it is just its name — not ", City Police".
 */
export function sortName(c: { firstName: string; lastName: string | null }): string {
    return c.lastName?.trim() ? `${c.lastName}, ${c.firstName}` : c.firstName;
}

/** The customer over their mobile, or their email when there is no mobile. */
export function customerHit(c: { id: string; firstName: string; lastName: string; mobile?: string | null; email?: string | null }): PickerHit {
    return { id: c.id, label: sortName(c), sublabel: c.mobile ?? c.email ?? null };
}

/** The plate over "2021 Toyota Hilux · Farrell, Courtney". */
export function vehicleHit(v: {
    id: string; plate: string; make: string; model: string; year: number | null; customerId: string | null;
    customer: { firstName: string; lastName: string } | null;
}): VehicleHit {
    const owner = v.customer ? sortName(v.customer) : null;
    const vehicle = [v.year, v.make, v.model].filter(Boolean).join(" ");
    return { id: v.id, label: v.plate, sublabel: owner ? `${vehicle} · ${owner}` : vehicle, customerId: v.customerId, ownerLabel: owner };
}
