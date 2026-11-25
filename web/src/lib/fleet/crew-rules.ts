import type { Designation, WorkshopKind } from "@prisma/client";
import type { Person } from "@/lib/fleet/route-rules";

/**
 * Who works at a workshop or bay besides its foremen, and who may put them on
 * a job while the vehicle is there. Pure, so the rules are tested without a
 * database; `crew.ts` and the settings services apply them.
 */

export const STAFF_ROLES = ["MECHANIC", "ARTISAN", "INTERN"] as const satisfies readonly Designation[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = { MECHANIC: "Mechanic", ARTISAN: "Artisan", INTERN: "Intern" };

export function isStaffRole(role: string | null | undefined): role is StaffRole {
    return (STAFF_ROLES as readonly string[]).includes(role ?? "");
}

/** The places that have staff of their own: workshops and bays. Reception and the check bay work by designation. */
export function hasStaff(kind: WorkshopKind): boolean {
    return kind === "WORKSHOP" || kind === "BAY";
}

/** Who may put people on a job at a place: its foreman or deputy, or somebody who manages the settings. */
export function mayAssign(person: Person, admin: boolean, workshopId: string): boolean {
    return admin || person.foremanOf.includes(workshopId);
}

/** Why nobody can be assigned at the place the vehicle is, or null when they can. */
export function assignError(visit: { kind: WorkshopKind; name: string; received: boolean; left: boolean } | null): string | null {
    if (!visit || visit.left) return "The vehicle is not at a workshop or bay at the moment.";
    if (!hasStaff(visit.kind)) return "People are assigned at a workshop or bay, not at reception or the check bay.";
    if (!visit.received) return `${visit.name} must accept the vehicle before anyone is assigned to it.`;
    return null;
}

/** The lead on a stay: whoever was assigned first among those still on it. */
export function leadOf(assignments: { membershipId: string; assignedAt: Date; removedAt: Date | null }[]): string | null {
    const live = assignments.filter((a) => !a.removedAt).sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime());
    return live[0]?.membershipId ?? null;
}
