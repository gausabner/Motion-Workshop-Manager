import "server-only";
import type { AuthorityKind, Designation, Tenant, WorkshopKind } from "@prisma/client";
import { Designation as DesignationEnum } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { organisationSettings } from "@/lib/settings/schema";
import type { VoteRow } from "@/lib/requisitions/csv";
import { hasStaff, isStaffRole } from "@/lib/fleet/crew-rules";

/**
 * The organisation a council's requisitions answer to, and the workshop they
 * come from, written inside transactions:
 *
 * - units of the organisation, one or two levels deep, named by the council;
 * - votes, each kept exactly as the finance system writes it;
 * - workshops and bays, each run by a unit;
 * - appointments: who signs for a workshop, a unit, or the value limit;
 * - each person's designations and pay number.
 *
 * Nothing that has been signed against is deleted. Units, votes and workshops
 * are archived instead, and only once nothing still depends on them.
 */

const audit = (tx: TenantTx, tenant: Tenant, actorUserId: string, entityType: string, entityId: string, action: string, diff?: object) =>
    tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId, entityType, entityId, action, diff } });

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

// ───────────────────────── units ─────────────────────────

export async function saveOrgUnit(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string | null, input: { name: string; parentId: string | null }): Promise<string> {
    const org = organisationSettings(tenant.settings);
    const name = clean(input.name);
    if (!name) throw new Error(`Name the ${org.topLevel.toLowerCase()}.`);
    if (name.length > 80) throw new Error("Keep the name to 80 characters or fewer.");
    if (input.parentId) {
        if (!org.secondLevel) throw new Error("Your organisation has one level, so a unit has nothing above it.");
        if (input.parentId === id) throw new Error("A unit cannot sit under itself.");
        const parent = await tx.orgUnit.findFirst({ where: { id: input.parentId, archivedAt: null }, select: { parentId: true } });
        if (!parent) throw new Error(`Choose a ${org.topLevel.toLowerCase()} from the list.`);
        if (parent.parentId) throw new Error(`A ${org.secondLevel.toLowerCase()} sits under a ${org.topLevel.toLowerCase()}, not under another ${org.secondLevel.toLowerCase()}.`);
        if (id && (await tx.orgUnit.count({ where: { parentId: id } })) > 0) {
            throw new Error(`${name} has units under it, so it stays a ${org.topLevel.toLowerCase()}.`);
        }
    }
    const clash = await tx.orgUnit.findFirst({
        where: { parentId: input.parentId, name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
    });
    if (clash) throw new Error(`There is already a unit called ${name} there.`);

    if (id) {
        const updated = await tx.orgUnit.updateMany({ where: { id }, data: { name, parentId: input.parentId } });
        if (!updated.count) throw new Error("That unit is no longer there. Refresh the page.");
        await audit(tx, tenant, actorUserId, "OrgUnit", id, "UPDATED", { name, parentId: input.parentId });
        return id;
    }
    const created = await tx.orgUnit.create({ data: { tenantId: tenant.id, name, parentId: input.parentId }, select: { id: true } });
    await audit(tx, tenant, actorUserId, "OrgUnit", created.id, "CREATED", { name, parentId: input.parentId });
    return created.id;
}

/** Archived only once nothing open depends on it: no unit, vote or workshop still in use under it. */
export async function archiveOrgUnit(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string, archived: boolean): Promise<void> {
    if (archived) {
        const [children, votes, workshops] = await Promise.all([
            tx.orgUnit.count({ where: { parentId: id, archivedAt: null } }),
            tx.vote.count({ where: { orgUnitId: id, archivedAt: null } }),
            tx.workshop.count({ where: { orgUnitId: id, archivedAt: null } }),
        ]);
        if (children) throw new Error("Archive the units under it first.");
        if (votes) throw new Error("Archive its votes first, or move them to another unit.");
        if (workshops) throw new Error("A workshop is still run by it. Move the workshop to another unit first.");
    }
    const updated = await tx.orgUnit.updateMany({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    if (!updated.count) throw new Error("That unit is no longer there. Refresh the page.");
    await audit(tx, tenant, actorUserId, "OrgUnit", id, archived ? "ARCHIVED" : "UNARCHIVED");
}

// ───────────────────────── votes ─────────────────────────

/** Letters, digits and the separators finance systems use; nothing a journal import would choke on. */
export function voteCodeError(code: string): string | null {
    if (!code) return "Enter the vote number.";
    if (code.length > 40) return "Keep the vote number to 40 characters or fewer.";
    if (!/^[A-Za-z0-9][A-Za-z0-9./ -]*$/.test(code)) return "Use the vote number exactly as the finance system writes it: letters, digits and . / - only.";
    return null;
}

export async function saveVote(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string | null, input: { code: string; name: string; orgUnitId: string }): Promise<string> {
    const code = input.code.trim();
    const name = clean(input.name);
    const bad = voteCodeError(code);
    if (bad) throw new Error(bad);
    if (!name) throw new Error("Name the vote, as the budget does.");
    const unit = await tx.orgUnit.findFirst({ where: { id: input.orgUnitId, archivedAt: null }, select: { id: true } });
    if (!unit) throw new Error("Choose the unit the vote belongs to.");
    const clash = await tx.vote.findFirst({ where: { code, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) throw new Error(`Vote ${code} is already in the list.`);
    if (id) {
        const updated = await tx.vote.updateMany({ where: { id }, data: { code, name, orgUnitId: input.orgUnitId } });
        if (!updated.count) throw new Error("That vote is no longer there. Refresh the page.");
        await audit(tx, tenant, actorUserId, "Vote", id, "UPDATED", { code, name });
        return id;
    }
    const created = await tx.vote.create({ data: { tenantId: tenant.id, code, name, orgUnitId: input.orgUnitId }, select: { id: true } });
    await audit(tx, tenant, actorUserId, "Vote", created.id, "CREATED", { code, name });
    return created.id;
}

export async function archiveVote(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string, archived: boolean): Promise<void> {
    const updated = await tx.vote.updateMany({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    if (!updated.count) throw new Error("That vote is no longer there. Refresh the page.");
    await audit(tx, tenant, actorUserId, "Vote", id, archived ? "ARCHIVED" : "UNARCHIVED");
}

/**
 * Votes from the finance system's export. A vote already in the list is
 * updated by its code — renamed, or moved to another unit — and anything else
 * is added. A unit is matched by its name, or by "Division / Department" where
 * two units share a name. Nothing is imported if any line cannot be.
 */
export async function importVotes(tx: TenantTx, tenant: Tenant, actorUserId: string, rows: VoteRow[]): Promise<{ created: number; updated: number; errors: { line: number; message: string }[] }> {
    const units = await tx.orgUnit.findMany({ where: { archivedAt: null }, select: { id: true, name: true, parentId: true } });
    const byId = new Map(units.map((u) => [u.id, u]));
    const keys = new Map<string, string[]>();
    for (const u of units) {
        const parent = u.parentId ? byId.get(u.parentId) : null;
        for (const key of [u.name, parent ? `${parent.name} / ${u.name}` : null]) {
            if (!key) continue;
            const k = key.toLowerCase().replace(/\s*\/\s*/g, " / ");
            keys.set(k, [...(keys.get(k) ?? []), u.id]);
        }
    }
    const errors: { line: number; message: string }[] = [];
    const resolved: { row: VoteRow; orgUnitId: string }[] = [];
    for (const row of rows) {
        const bad = voteCodeError(row.code);
        if (bad) { errors.push({ line: row.line, message: `${row.code}: ${bad}` }); continue; }
        const found = keys.get(row.unit.toLowerCase().replace(/\s*\/\s*/g, " / ")) ?? [];
        if (found.length === 0) errors.push({ line: row.line, message: `No unit called ${row.unit}. Add it first, or check the spelling.` });
        else if (found.length > 1) errors.push({ line: row.line, message: `More than one unit is called ${row.unit}. Write it as "Division / Department".` });
        else resolved.push({ row, orgUnitId: found[0] });
    }
    if (errors.length) return { created: 0, updated: 0, errors };

    const existing = new Map((await tx.vote.findMany({ where: { code: { in: resolved.map((r) => r.row.code) } }, select: { id: true, code: true } })).map((v) => [v.code, v.id]));
    let created = 0;
    let updated = 0;
    for (const { row, orgUnitId } of resolved) {
        const id = existing.get(row.code);
        if (id) {
            await tx.vote.update({ where: { id }, data: { name: clean(row.name), orgUnitId, archivedAt: null } });
            updated++;
        } else {
            await tx.vote.create({ data: { tenantId: tenant.id, code: row.code, name: clean(row.name), orgUnitId } });
            created++;
        }
    }
    await audit(tx, tenant, actorUserId, "Vote", tenant.id, "IMPORTED", { created, updated });
    return { created, updated, errors };
}

// ───────────────────────── workshops ─────────────────────────

export async function saveWorkshop(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string | null, input: { name: string; kind: WorkshopKind; orgUnitId: string }): Promise<string> {
    const name = clean(input.name);
    if (!name) throw new Error("Name the workshop or bay.");
    if (name.length > 80) throw new Error("Keep the name to 80 characters or fewer.");
    const unit = await tx.orgUnit.findFirst({ where: { id: input.orgUnitId, archivedAt: null }, select: { id: true } });
    if (!unit) throw new Error("Choose the unit that runs it.");
    const clash = await tx.workshop.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) throw new Error(`There is already a workshop or bay called ${name}.`);
    if (id) {
        const updated = await tx.workshop.updateMany({ where: { id }, data: { name, kind: input.kind, orgUnitId: input.orgUnitId } });
        if (!updated.count) throw new Error("That workshop is no longer there. Refresh the page.");
        await audit(tx, tenant, actorUserId, "Workshop", id, "UPDATED", { name, kind: input.kind });
        return id;
    }
    const created = await tx.workshop.create({ data: { tenantId: tenant.id, name, kind: input.kind, orgUnitId: input.orgUnitId }, select: { id: true } });
    await audit(tx, tenant, actorUserId, "Workshop", created.id, "CREATED", { name, kind: input.kind });
    return created.id;
}

export async function archiveWorkshop(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string, archived: boolean): Promise<void> {
    const updated = await tx.workshop.updateMany({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    if (!updated.count) throw new Error("That workshop is no longer there. Refresh the page.");
    await audit(tx, tenant, actorUserId, "Workshop", id, archived ? "ARCHIVED" : "UNARCHIVED");
}

// ───────────────────────── appointments ─────────────────────────

export const AUTHORITY_LABEL: Record<AuthorityKind, string> = {
    FOREMAN: "Foreman",
    DIVISION_HEAD: "Divisional Head",
    FLEET_COORDINATOR: "Fleet Coordinator",
    OVER_LIMIT: "Approver above the value limit",
};

/**
 * Appoint somebody to sign. A foreman for a workshop; a divisional head or
 * fleet coordinator for a unit, and so for everything under it; the over-limit
 * approver for the whole council. The database refuses a mismatched scope as
 * well; this says why in words.
 */
export async function appoint(
    tx: TenantTx,
    tenant: Tenant,
    actorUserId: string,
    input: { kind: AuthorityKind; workshopId: string | null; orgUnitId: string | null; membershipId: string; deputy: boolean },
): Promise<string> {
    const workshopId = input.kind === "FOREMAN" ? input.workshopId : null;
    const orgUnitId = input.kind === "DIVISION_HEAD" || input.kind === "FLEET_COORDINATOR" ? input.orgUnitId : null;
    if (input.kind === "FOREMAN" && !workshopId) throw new Error("Choose the workshop the foreman signs for.");
    if ((input.kind === "DIVISION_HEAD" || input.kind === "FLEET_COORDINATOR") && !orgUnitId) throw new Error("Choose the unit they sign for.");
    if (workshopId && !(await tx.workshop.findFirst({ where: { id: workshopId, archivedAt: null }, select: { id: true } }))) throw new Error("That workshop is no longer in use.");
    if (orgUnitId && !(await tx.orgUnit.findFirst({ where: { id: orgUnitId, archivedAt: null }, select: { id: true } }))) throw new Error("That unit is no longer in use.");
    const person = await tx.membership.findFirst({ where: { id: input.membershipId, status: "ACTIVE" }, select: { id: true } });
    if (!person) throw new Error("Choose somebody on the team.");
    const already = await tx.signingAuthority.findFirst({ where: { kind: input.kind, workshopId, orgUnitId, membershipId: input.membershipId }, select: { id: true } });
    if (already) throw new Error(`They are already appointed ${AUTHORITY_LABEL[input.kind].toLowerCase()} there.`);
    const created = await tx.signingAuthority.create({
        data: { tenantId: tenant.id, kind: input.kind, workshopId, orgUnitId, membershipId: input.membershipId, deputy: input.deputy },
        select: { id: true },
    });
    await audit(tx, tenant, actorUserId, "SigningAuthority", created.id, "CREATED", { kind: input.kind, workshopId, orgUnitId, membershipId: input.membershipId, deputy: input.deputy });
    return created.id;
}

/** Signatures already given stay on their requisitions; ending an appointment only stops new ones. */
export async function revoke(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string): Promise<void> {
    const row = await tx.signingAuthority.findUnique({ where: { id }, select: { kind: true, membershipId: true } });
    if (!row) return;
    await tx.signingAuthority.delete({ where: { id } });
    await audit(tx, tenant, actorUserId, "SigningAuthority", id, "DELETED", row);
}

/**
 * Put somebody else in an appointment in one step: the same kind, the same
 * place, the same deputy standing. Signatures the person replaced has given
 * stay on their requisitions.
 */
export async function replaceAuthority(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string, membershipId: string): Promise<string> {
    const row = await tx.signingAuthority.findUnique({ where: { id }, select: { kind: true, workshopId: true, orgUnitId: true, membershipId: true, deputy: true } });
    if (!row) throw new Error("That appointment has already ended. Refresh the page.");
    if (row.membershipId === membershipId) throw new Error("Choose somebody else to take their place.");
    await revoke(tx, tenant, actorUserId, id);
    return appoint(tx, tenant, actorUserId, { kind: row.kind, workshopId: row.workshopId, orgUnitId: row.orgUnitId, membershipId, deputy: row.deputy });
}

// ───────────────────────── workshop staff ─────────────────────────

/** Somebody who works at a workshop or bay. They can clock on to jobs from then on, so they are marked a mechanic. */
export async function addStaff(tx: TenantTx, tenant: Tenant, actorUserId: string, input: { workshopId: string; membershipId: string; role: string }): Promise<string> {
    if (!isStaffRole(input.role)) throw new Error("Choose whether they are a mechanic, artisan or intern.");
    const workshop = await tx.workshop.findFirst({ where: { id: input.workshopId, archivedAt: null }, select: { name: true, kind: true } });
    if (!workshop) throw new Error("Choose a workshop or bay that is in use.");
    if (!hasStaff(workshop.kind)) throw new Error("Staff belong to a workshop or bay. Reception and the check bay work by designation, in Team.");
    const person = await tx.membership.findFirst({ where: { id: input.membershipId, status: "ACTIVE" }, select: { id: true, isMechanic: true } });
    if (!person) throw new Error("Choose somebody on the team.");
    const already = await tx.workshopStaff.findFirst({ where: { workshopId: input.workshopId, membershipId: input.membershipId }, select: { id: true } });
    if (already) throw new Error(`They are already on the staff of ${workshop.name}.`);
    const created = await tx.workshopStaff.create({ data: { tenantId: tenant.id, workshopId: input.workshopId, membershipId: input.membershipId, role: input.role }, select: { id: true } });
    if (!person.isMechanic) await tx.membership.updateMany({ where: { id: person.id }, data: { isMechanic: true } });
    await audit(tx, tenant, actorUserId, "WorkshopStaff", created.id, "CREATED", input);
    return created.id;
}

/** Jobs they are on now keep them; they simply cannot be put on new ones here. */
export async function removeStaff(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string): Promise<void> {
    const row = await tx.workshopStaff.findUnique({ where: { id }, select: { workshopId: true, membershipId: true, role: true } });
    if (!row) return;
    await tx.workshopStaff.delete({ where: { id } });
    await audit(tx, tenant, actorUserId, "WorkshopStaff", id, "DELETED", row);
}

export async function replaceStaff(tx: TenantTx, tenant: Tenant, actorUserId: string, id: string, membershipId: string): Promise<string> {
    const row = await tx.workshopStaff.findUnique({ where: { id }, select: { workshopId: true, membershipId: true, role: true } });
    if (!row) throw new Error("They are no longer on the staff. Refresh the page.");
    if (row.membershipId === membershipId) throw new Error("Choose somebody else to take their place.");
    await removeStaff(tx, tenant, actorUserId, id);
    return addStaff(tx, tenant, actorUserId, { workshopId: row.workshopId, membershipId, role: row.role });
}

// ───────────────────────── people ─────────────────────────

export const DESIGNATION_LABEL: Record<Designation, string> = {
    RECEPTION: "Reception",
    FOREMAN: "Foreman",
    FLEET_COORDINATOR: "Fleet Coordinator",
    MECHANIC: "Mechanic",
    ARTISAN: "Artisan",
    INTERN: "Intern",
    PARTS_DRIVER: "Parts Driver",
    STOREMAN: "Storeman",
    DIVISION_HEAD: "Division Head",
};

export const ALL_DESIGNATIONS = Object.values(DesignationEnum);

export async function saveDesignations(tx: TenantTx, tenant: Tenant, actorUserId: string, membershipId: string, input: { designations: string[]; payNumber: string | null }): Promise<void> {
    const designations = [...new Set(input.designations)].filter((d): d is Designation => (ALL_DESIGNATIONS as string[]).includes(d));
    const payNumber = input.payNumber?.trim() || null;
    if (payNumber && payNumber.length > 30) throw new Error("Keep the pay number to 30 characters or fewer.");
    const updated = await tx.membership.updateMany({ where: { id: membershipId }, data: { designations, payNumber } });
    if (!updated.count) throw new Error("That person is no longer on the team. Refresh the page.");
    await audit(tx, tenant, actorUserId, "Membership", membershipId, "DESIGNATIONS", { designations, payNumber });
}
