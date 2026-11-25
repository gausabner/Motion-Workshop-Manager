import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { assign, routeLead, unassign, type Assigner } from "@/lib/fleet/crew";
import { addStaff, removeStaff, replaceAuthority, replaceStaff } from "@/lib/requisitions/organisation";
import { routeView } from "@/lib/fleet/queries";
import { floorView } from "@/lib/time/queries";

/**
 * A workshop's staff, and the people its foreman puts on a job while the
 * vehicle is there: who may, who can be, and how the first still on it
 * becomes the job card's Mechanic.
 */

const SLUG = "zztest-crew";
const PEOPLE = ["foreman", "deputy", "admin", "clerk", "thabo", "maria", "intern", "stranger"] as const;
type Who = (typeof PEOPLE)[number];

let tenant: Tenant;
let job = "";
let visit = "";
const people = {} as Record<Who, { membershipId: string; userId: string }>;
const place = { reception: "", heavy: "", tyres: "" };

const db = () => forTenant(tenant.id);
type Tx = Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0];
const run = <T,>(fn: (tx: Tx) => Promise<T>) => db().$transaction(fn) as Promise<T>;
const as = (who: Who, admin = false): Assigner => ({ ...people[who], admin });
const lead = async () => (await prisma.document.findUniqueOrThrow({ where: { id: job }, select: { mechanicId: true } })).mechanicId;
const live = () => prisma.visitAssignment.findMany({ where: { visitId: visit, removedAt: null }, orderBy: { assignedAt: "asc" }, select: { id: true, membershipId: true } });

before(async () => {
    tenant = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Crew Organisation", country: "NA" } });
    for (const p of PEOPLE) {
        const user = await prisma.user.create({ data: { email: `${SLUG}-${p}@example.invalid`, passwordHash: "x", firstName: p, lastName: "ZZTEST" }, select: { id: true } });
        const group = p === "admin" ? "ADMIN" : "FOREMAN";
        const m = await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, group, status: "ACTIVE" }, select: { id: true } });
        people[p] = { membershipId: m.id, userId: user.id };
    }
    const unit = (await prisma.orgUnit.create({ data: { tenantId: tenant.id, name: "Fleet Management" }, select: { id: true } })).id;
    const ws = (name: string, kind: "RECEPTION" | "WORKSHOP" | "BAY") => prisma.workshop.create({ data: { tenantId: tenant.id, name, kind, orgUnitId: unit }, select: { id: true } }).then((w) => w.id);
    place.reception = await ws("Reception", "RECEPTION");
    place.heavy = await ws("Heavy duty vehicles", "WORKSHOP");
    place.tyres = await ws("Tyre bay", "BAY");
    await prisma.signingAuthority.create({ data: { tenantId: tenant.id, kind: "FOREMAN", workshopId: place.heavy, membershipId: people.foreman.membershipId } });
    await prisma.signingAuthority.create({ data: { tenantId: tenant.id, kind: "FOREMAN", workshopId: place.heavy, membershipId: people.deputy.membershipId, deputy: true } });
    job = (await prisma.document.create({ data: { tenantId: tenant.id, type: "JOB_CARD", jobNumber: "JC-9101", jobStatus: "WORK_IN_PROGRESS" }, select: { id: true } })).id;
    visit = (await prisma.jobVisit.create({ data: { tenantId: tenant.id, documentId: job, workshopId: place.heavy, purpose: "WORK" }, select: { id: true } })).id;
});

after(async () => {
    const tenantId = tenant.id;
    await prisma.visitAssignment.deleteMany({ where: { tenantId } });
    await prisma.workshopStaff.deleteMany({ where: { tenantId } });
    await prisma.timeEntry.deleteMany({ where: { tenantId } });
    await prisma.jobVisit.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.signingAuthority.deleteMany({ where: { tenantId } });
    await prisma.workshop.deleteMany({ where: { tenantId } });
    await prisma.orgUnit.deleteMany({ where: { tenantId } });
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("a workshop's staff: mechanics, artisans and interns, at workshops and bays only, once each", async () => {
    const add = (who: Who, role: string, workshopId = place.heavy) => run((tx) => addStaff(tx, tenant, people.admin.userId, { workshopId, membershipId: people[who].membershipId, role }));
    await assert.rejects(add("thabo", "STOREMAN"), /mechanic, artisan or intern/);
    await assert.rejects(add("thabo", "MECHANIC", place.reception), /Reception and the check bay work by designation/);
    await add("thabo", "MECHANIC");
    await assert.rejects(add("thabo", "ARTISAN"), /already on the staff of Heavy duty vehicles/);
    await add("maria", "ARTISAN");
    await add("thabo", "MECHANIC", place.tyres);
    const thabo = await prisma.membership.findUniqueOrThrow({ where: { id: people.thabo.membershipId }, select: { isMechanic: true } });
    assert.equal(thabo.isMechanic, true, "on a staff, so they can clock on");

    const tyres = await prisma.workshopStaff.findFirstOrThrow({ where: { workshopId: place.tyres }, select: { id: true } });
    await assert.rejects(run((tx) => replaceStaff(tx, tenant, people.admin.userId, tyres.id, people.thabo.membershipId)), /somebody else/);
    await run((tx) => replaceStaff(tx, tenant, people.admin.userId, tyres.id, people.intern.membershipId));
    const now = await prisma.workshopStaff.findMany({ where: { workshopId: place.tyres }, select: { membershipId: true, role: true } });
    assert.deepEqual(now, [{ membershipId: people.intern.membershipId, role: "MECHANIC" }], "replaced in one step, same role");
    await run(async (tx) => removeStaff(tx, tenant, people.admin.userId, (await tx.workshopStaff.findFirstOrThrow({ where: { workshopId: place.tyres } })).id));
    assert.equal(await prisma.workshopStaff.count({ where: { workshopId: place.tyres } }), 0);
});

test("replacing a foreman keeps the place and the deputy standing", async () => {
    const deputy = await prisma.signingAuthority.findFirstOrThrow({ where: { membershipId: people.deputy.membershipId }, select: { id: true } });
    await run((tx) => replaceAuthority(tx, tenant, people.admin.userId, deputy.id, people.clerk.membershipId));
    const after = await prisma.signingAuthority.findMany({ where: { workshopId: place.heavy }, orderBy: { createdAt: "asc" }, select: { membershipId: true, deputy: true, kind: true } });
    assert.deepEqual(after, [
        { membershipId: people.foreman.membershipId, deputy: false, kind: "FOREMAN" },
        { membershipId: people.clerk.membershipId, deputy: true, kind: "FOREMAN" },
    ]);
});

test("nobody is put on it before the workshop accepts it", async () => {
    await assert.rejects(run((tx) => assign(tx, tenant, as("foreman"), job, people.thabo.membershipId)), /must accept the vehicle/);
    assert.equal(await run((tx) => routeLead(tx, job)), undefined, "nobody assigned on this stay: the job card's own Mechanic stands");
    await prisma.jobVisit.update({ where: { id: visit }, data: { receivedAt: new Date(), receivedById: people.foreman.membershipId } });
});

test("the foreman, a deputy or an administrator assigns, and only the workshop's own staff", async () => {
    await assert.rejects(run((tx) => assign(tx, tenant, as("stranger"), job, people.thabo.membershipId)), /Only the foreman of Heavy duty vehicles/);
    await assert.rejects(run((tx) => assign(tx, tenant, as("foreman"), job, people.stranger.membershipId)), /on the staff of Heavy duty vehicles/);
    await run((tx) => assign(tx, tenant, as("foreman"), job, people.thabo.membershipId));
    await assert.rejects(run((tx) => assign(tx, tenant, as("foreman"), job, people.thabo.membershipId)), /already on this job/);
    await run((tx) => assign(tx, tenant, as("clerk"), job, people.maria.membershipId)); // the deputy now
    assert.equal((await live()).length, 2);

    const seen = await routeView(db(), tenant, job, people.stranger.membershipId);
    assert.equal(seen.crew?.canAssign, false, "anyone may see who is on it");
    const admin = await routeView(db(), tenant, job, people.admin.membershipId);
    assert.equal(admin.crew?.canAssign, true, "an administrator may assign");
    assert.deepEqual(admin.crew?.people.map((p) => [p.name, p.role, p.lead]), [["thabo ZZTEST", "Mechanic", true], ["maria ZZTEST", "Artisan", false]]);
    assert.deepEqual(admin.crew?.staff, [], "everybody on the staff is already on it");
});

test("the first still on it is the job card's Mechanic, and everybody on it sees it on the floor", async () => {
    assert.equal(await lead(), people.thabo.membershipId, "first assigned is the lead");
    assert.equal(await run((tx) => routeLead(tx, job)), people.thabo.membershipId, "a save of the job card keeps the lead");
    const floor = await floorView(db(), tenant, people.maria.membershipId);
    assert.ok(floor.mine.some((j) => j.id === job), "on the floor app of somebody who is not the lead");

    const [thabo] = await live();
    await run((tx) => unassign(tx, tenant, as("admin", true), job, thabo.id));
    assert.equal(await lead(), people.maria.membershipId, "the next becomes the lead");
    await assert.rejects(run((tx) => unassign(tx, tenant, as("foreman"), job, thabo.id)), /no longer on this job/);

    const [maria] = await live();
    await run((tx) => unassign(tx, tenant, as("foreman"), job, maria.id));
    assert.equal(await lead(), null, "nobody on it, no Mechanic");
    assert.equal(await run((tx) => routeLead(tx, job)), null, "and a save does not put an old Mechanic back");
    assert.equal(await prisma.visitAssignment.count({ where: { visitId: visit } }), 2, "ended assignments stay as history");
});
