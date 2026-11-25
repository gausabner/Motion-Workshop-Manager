import "server-only";
import type { NotificationKind, WorkshopKind } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { fullName } from "@/lib/format";
import { hasStaff } from "@/lib/fleet/crew-rules";

/**
 * Putting something in people's notification lists, inside the transaction
 * that caused it, so a move that fails leaves nobody told about it. Whoever
 * did it is never told about their own act.
 */

export type Note = { kind: NotificationKind; title: string; body?: string | null; href: string };

export async function notify(tx: TenantTx, tenantId: string, recipients: Iterable<string>, note: Note, except?: string): Promise<number> {
    const to = [...new Set(recipients)].filter((id) => id !== except);
    if (!to.length) return 0;
    const made = await tx.notification.createMany({ data: to.map((membershipId) => ({ tenantId, membershipId, ...note, body: note.body ?? null })) });
    return made.count;
}

/**
 * Who works at a place, as the route decides it: reception is everybody
 * designated Reception; the check bay is its foremen; a workshop or bay is its
 * foremen and deputies and its staff.
 */
export async function peopleAt(tx: TenantTx, place: { id: string; kind: WorkshopKind }): Promise<string[]> {
    const active = { status: "ACTIVE" as const };
    if (place.kind === "RECEPTION") {
        return (await tx.membership.findMany({ where: { ...active, designations: { has: "RECEPTION" } }, select: { id: true } })).map((m) => m.id);
    }
    const [foremen, staff] = await Promise.all([
        tx.signingAuthority.findMany({ where: { kind: "FOREMAN", workshopId: place.id, membership: active }, select: { membershipId: true } }),
        hasStaff(place.kind) ? tx.workshopStaff.findMany({ where: { workshopId: place.id, membership: active }, select: { membershipId: true } }) : Promise.resolve([]),
    ]);
    return [...foremen, ...staff].map((p) => p.membershipId);
}

/** How a notification names the job: its number and the vehicle, as a person at the place would know it. */
export async function jobLine(tx: TenantTx, documentId: string): Promise<{ number: string; vehicle: string | null }> {
    const job = await tx.document.findFirst({
        where: { id: documentId },
        select: { jobNumber: true, number: true, vehicle: { select: { plate: true, make: true, model: true } } },
    });
    const v = job?.vehicle;
    return {
        number: job?.jobNumber ?? job?.number ?? "A job card",
        vehicle: v ? [v.plate, [v.make, v.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ") : null,
    };
}

export async function nameOf(tx: TenantTx, membershipId: string): Promise<string> {
    const m = await tx.membership.findFirst({ where: { id: membershipId }, select: { user: { select: { firstName: true, lastName: true } } } });
    return m ? fullName(m.user) : "Somebody";
}
