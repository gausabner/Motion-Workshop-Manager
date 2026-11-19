import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { parseVoteCsv } from "@/lib/requisitions/csv";
import { appoint, archiveOrgUnit, importVotes, revoke, saveDesignations, saveOrgUnit, saveVote, saveWorkshop } from "@/lib/requisitions/organisation";

/**
 * The council's organisation against a real database: one or two levels and
 * never three, votes kept as the finance system writes them and imported all
 * or nothing, appointments only where their kind belongs, nothing archived
 * while something still depends on it, and designations on each person.
 */

const SLUG = "zztest-organisation";
let tenant: Tenant;
let actor = "";
let member = "";

const db = () => forTenant(tenant.id);
const run = <T,>(fn: (tx: Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0]) => Promise<T>) => db().$transaction(fn) as Promise<T>;

before(async () => {
    tenant = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Organisation Council", country: "NA" } });
    actor = (await prisma.user.create({ data: { email: `${SLUG}-owner@example.invalid`, passwordHash: "x", firstName: "Owner", lastName: "ZZTEST" }, select: { id: true } })).id;
    member = (await prisma.membership.create({ data: { tenantId: tenant.id, userId: actor, group: "OWNER", status: "ACTIVE" }, select: { id: true } })).id;
});

after(async () => {
    const tenantId = tenant.id;
    await prisma.signingAuthority.deleteMany({ where: { tenantId } });
    await prisma.vote.deleteMany({ where: { tenantId } });
    await prisma.workshop.deleteMany({ where: { tenantId } });
    await prisma.orgUnit.deleteMany({ where: { tenantId, parentId: { not: null } } });
    await prisma.orgUnit.deleteMany({ where: { tenantId } });
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("the organisation is one or two levels deep, never three, and names are unique where they sit", async () => {
    const technical = await run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "Technical Services", parentId: null }));
    const fleet = await run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "Fleet Management", parentId: technical }));
    await assert.rejects(run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "Workshops", parentId: fleet })), /sits under a division, not under another department/);
    await assert.rejects(run((tx) => saveOrgUnit(tx, tenant, actor, technical, { name: "Technical Services", parentId: fleet })), /cannot sit under itself|has units under it|not under another/);
    await assert.rejects(run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "technical services", parentId: null })), /already a unit called/);
    // The same department name under two divisions is two departments.
    const community = await run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "Community Services", parentId: null }));
    await run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "Administration", parentId: technical }));
    await run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "Administration", parentId: community }));
});

test("a council with one level has no units under others", async () => {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { settings: { organisation: { topLevel: "Department", secondLevel: null } } } });
    tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    const top = await prisma.orgUnit.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Technical Services" }, select: { id: true } });
    await assert.rejects(run((tx) => saveOrgUnit(tx, tenant, actor, null, { name: "Stores", parentId: top.id })), /one level/);
    await prisma.tenant.update({ where: { id: tenant.id }, data: { settings: {} } });
    tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
});

test("votes are imported all or nothing, matched to units by name or by path, and updated by their number", async () => {
    const bad = parseVoteCsv("2000025105010,Protective clothing,Fleet Management\n2000031204020,Vehicle maintenance,Parks");
    const refused = await run((tx) => importVotes(tx, tenant, actor, bad.rows));
    assert.deepEqual(refused.errors.map((e) => e.line), [2], "Parks does not exist yet");
    assert.equal(await db().vote.count(), 0, "nothing imported while any line cannot be");

    const ambiguous = await run((tx) => importVotes(tx, tenant, actor, parseVoteCsv("100,Admin costs,Administration").rows));
    assert.match(ambiguous.errors[0].message, /More than one unit is called Administration/);

    const ok = await run((tx) => importVotes(tx, tenant, actor, parseVoteCsv("0200025105010,Protective clothing,Fleet Management\n100,Admin costs,Community Services / Administration").rows));
    assert.deepEqual([ok.created, ok.updated, ok.errors.length], [2, 0, 0]);
    const again = await run((tx) => importVotes(tx, tenant, actor, parseVoteCsv("0200025105010,Protective and safety clothing,Fleet Management").rows));
    assert.deepEqual([again.created, again.updated], [0, 1]);
    const vote = await db().vote.findFirstOrThrow({ where: { code: "0200025105010" }, select: { name: true } });
    assert.equal(vote.name, "Protective and safety clothing", "the leading zero kept, the name updated");

    const fleet = await prisma.orgUnit.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Fleet Management" }, select: { id: true } });
    await assert.rejects(run((tx) => saveVote(tx, tenant, actor, null, { code: "0200025105010", name: "Again", orgUnitId: fleet.id })), /already in the list/);
    await assert.rejects(run((tx) => saveVote(tx, tenant, actor, null, { code: "2000 025*", name: "Odd", orgUnitId: fleet.id })), /exactly as the finance system/);
});

test("nothing is archived while something still depends on it", async () => {
    const fleet = await prisma.orgUnit.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Fleet Management" }, select: { id: true } });
    const technical = await prisma.orgUnit.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Technical Services" }, select: { id: true } });
    await run((tx) => saveWorkshop(tx, tenant, actor, null, { name: "Heavy duty vehicles", kind: "WORKSHOP", orgUnitId: fleet.id }));
    await assert.rejects(run((tx) => archiveOrgUnit(tx, tenant, actor, technical.id, true)), /units under it/);
    await assert.rejects(run((tx) => archiveOrgUnit(tx, tenant, actor, fleet.id, true)), /Archive its votes first/);
    await assert.rejects(run((tx) => saveWorkshop(tx, tenant, actor, null, { name: "heavy duty vehicles", kind: "BAY", orgUnitId: fleet.id })), /already a workshop or bay called/);
});

test("an appointment goes only where its kind belongs, and once per person", async () => {
    const fleet = await prisma.orgUnit.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Fleet Management" }, select: { id: true } });
    const heavy = await prisma.workshop.findFirstOrThrow({ where: { tenantId: tenant.id }, select: { id: true } });
    await assert.rejects(run((tx) => appoint(tx, tenant, actor, { kind: "FOREMAN", workshopId: null, orgUnitId: fleet.id, membershipId: member, deputy: false })), /Choose the workshop/);
    const foreman = await run((tx) => appoint(tx, tenant, actor, { kind: "FOREMAN", workshopId: heavy.id, orgUnitId: fleet.id, membershipId: member, deputy: false }));
    const row = await prisma.signingAuthority.findUniqueOrThrow({ where: { id: foreman }, select: { orgUnitId: true, workshopId: true } });
    assert.deepEqual(row, { orgUnitId: null, workshopId: heavy.id }, "a foreman's appointment carries the workshop and nothing else");
    await assert.rejects(run((tx) => appoint(tx, tenant, actor, { kind: "FOREMAN", workshopId: heavy.id, orgUnitId: null, membershipId: member, deputy: true })), /already appointed foreman/);
    await run((tx) => appoint(tx, tenant, actor, { kind: "OVER_LIMIT", workshopId: heavy.id, orgUnitId: fleet.id, membershipId: member, deputy: false }));
    await assert.rejects(run((tx) => appoint(tx, tenant, actor, { kind: "OVER_LIMIT", workshopId: null, orgUnitId: null, membershipId: member, deputy: false })), /already appointed/);
    await run((tx) => revoke(tx, tenant, actor, foreman));
    assert.equal(await db().signingAuthority.count({ where: { kind: "FOREMAN" } }), 0);
});

test("a person's designations and pay number are saved; anything not a designation is dropped", async () => {
    await run((tx) => saveDesignations(tx, tenant, actor, member, { designations: ["FOREMAN", "FLEET_COORDINATOR", "FOREMAN", "WIZARD"], payNumber: " PN-20431 " }));
    const m = await prisma.membership.findUniqueOrThrow({ where: { id: member }, select: { designations: true, payNumber: true } });
    assert.deepEqual(m, { designations: ["FOREMAN", "FLEET_COORDINATOR"], payNumber: "PN-20431" });
});
