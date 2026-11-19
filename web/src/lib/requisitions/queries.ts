import "server-only";
import type { TenantDb } from "@/lib/tenant-db";
import { fullName } from "@/lib/format";
import { DESIGNATION_LABEL } from "@/lib/requisitions/organisation";

/**
 * What the council's settings screens show, read through the scoped client.
 * Plain values only — no Decimal, no Date — so they cross to client components
 * as they are.
 */

export async function teamPeople(db: TenantDb) {
    const members = await db.membership.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, group: true, payNumber: true, designations: true, user: { select: { firstName: true, lastName: true } } },
        orderBy: [{ user: { firstName: "asc" } }],
    });
    return members.map((m) => ({
        id: m.id,
        name: fullName(m.user),
        group: m.group,
        payNumber: m.payNumber,
        designations: m.designations,
        designationLabels: m.designations.map((d) => DESIGNATION_LABEL[d]),
    }));
}

export async function organisation(db: TenantDb) {
    const [units, votes, authorities, workshops] = await Promise.all([
        db.orgUnit.findMany({ select: { id: true, name: true, parentId: true, archivedAt: true }, orderBy: { name: "asc" } }),
        db.vote.findMany({ select: { id: true, code: true, name: true, orgUnitId: true, archivedAt: true }, orderBy: { code: "asc" } }),
        db.signingAuthority.findMany({
            select: { id: true, kind: true, orgUnitId: true, workshopId: true, membershipId: true, deputy: true, membership: { select: { user: { select: { firstName: true, lastName: true } } } } },
            orderBy: [{ deputy: "asc" }, { createdAt: "asc" }],
        }),
        db.workshop.findMany({ select: { id: true, name: true, kind: true, orgUnitId: true, archivedAt: true }, orderBy: { name: "asc" } }),
    ]);
    const byId = new Map(units.map((u) => [u.id, u]));
    return {
        units: units.map((u) => ({ id: u.id, name: u.name, parentId: u.parentId, archived: !!u.archivedAt })),
        unitLabel: (id: string) => {
            const u = byId.get(id);
            const parent = u?.parentId ? byId.get(u.parentId) : null;
            return u ? (parent ? `${parent.name} / ${u.name}` : u.name) : "";
        },
        votes: votes.map((v) => ({ id: v.id, code: v.code, name: v.name, orgUnitId: v.orgUnitId, archived: !!v.archivedAt })),
        workshops: workshops.map((w) => ({ id: w.id, name: w.name, kind: w.kind, orgUnitId: w.orgUnitId, archived: !!w.archivedAt })),
        authorities: authorities.map((a) => ({
            id: a.id, kind: a.kind, orgUnitId: a.orgUnitId, workshopId: a.workshopId, membershipId: a.membershipId, deputy: a.deputy, name: fullName(a.membership.user),
        })),
    };
}
