import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Designation, Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { acceptVisit, bookIn, sendOn, signJob, type Actor } from "@/lib/fleet/route";

/**
 * One vehicle's whole route against a real database, as the owner described
 * it: booked in at reception and the job card signed by five people; the
 * check bay's assessment; heavy duty, then the tyre bay; a failed quality
 * check and back to the tyre bay; a pass; reception; and the driver collects.
 * Every gate is tried on the way, and one vehicle is never in two places.
 */

const SLUG = "zztest-route";
const PEOPLE = ["receptionist", "driverClerk", "checkForeman", "heavyForeman", "tyreForeman", "fleetCoordinator", "artisan"] as const;
type Person = (typeof PEOPLE)[number];
const DESIGNATIONS: Record<Person, Designation[]> = {
    receptionist: ["RECEPTION"], driverClerk: ["RECEPTION"], checkForeman: ["FOREMAN"], heavyForeman: ["FOREMAN"],
    tyreForeman: ["FOREMAN"], fleetCoordinator: ["FLEET_COORDINATOR"], artisan: ["ARTISAN"],
};

let tenant: Tenant;
let job = "";
const people = {} as Record<Person, Actor>;
const place = { reception: "", check: "", heavy: "", tyres: "" };

const db = () => forTenant(tenant.id);
const run = <T,>(fn: (tx: Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0]) => Promise<T>) => db().$transaction(fn) as Promise<T>;
const send = (who: Person, purpose: "ASSESSMENT" | "WORK" | "QUALITY_CHECK" | "RELEASE", to: keyof typeof place) =>
    run((tx) => sendOn(tx, tenant, people[who], job, { purpose, workshopId: place[to] }));
const open = () => prisma.jobVisit.findFirstOrThrow({ where: { documentId: job, leftAt: null }, select: { id: true, workshopId: true, purpose: true, receivedAt: true } });
const accept = async (who: Person) => run(async (tx) => acceptVisit(tx, tenant, people[who], (await open()).id));
const sign = (who: Person, input: Parameters<typeof signJob>[4]) => run((tx) => signJob(tx, tenant, people[who], job, input));

before(async () => {
    tenant = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Route Council", country: "NA" } });
    for (const p of PEOPLE) {
        const user = await prisma.user.create({ data: { email: `${SLUG}-${p}@example.invalid`, passwordHash: "x", firstName: p, lastName: "ZZTEST" }, select: { id: true } });
        const m = await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, group: "FOREMAN", status: "ACTIVE", designations: DESIGNATIONS[p], payNumber: `PN-${p.length}` }, select: { id: true } });
        people[p] = { membershipId: m.id, userId: user.id };
    }
    const unit = (await prisma.orgUnit.create({ data: { tenantId: tenant.id, name: "Fleet Management" }, select: { id: true } })).id;
    const ws = (name: string, kind: "RECEPTION" | "CHECK_BAY" | "WORKSHOP" | "BAY") =>
        prisma.workshop.create({ data: { tenantId: tenant.id, name, kind, orgUnitId: unit }, select: { id: true } }).then((w) => w.id);
    place.reception = await ws("Reception", "RECEPTION");
    place.check = await ws("Check bay", "CHECK_BAY");
    place.heavy = await ws("Heavy duty vehicles", "WORKSHOP");
    place.tyres = await ws("Tyre bay", "BAY");
    const foreman = (who: Person, workshopId: string) => prisma.signingAuthority.create({ data: { tenantId: tenant.id, kind: "FOREMAN", workshopId, membershipId: people[who].membershipId } });
    await foreman("checkForeman", place.check);
    await foreman("heavyForeman", place.heavy);
    await foreman("tyreForeman", place.tyres);
    job = (await prisma.document.create({ data: { tenantId: tenant.id, type: "JOB_CARD", jobNumber: "JC-9001", jobStatus: "BOOKED_IN" }, select: { id: true } })).id;
});

after(async () => {
    const tenantId = tenant.id;
    await prisma.jobSignoff.deleteMany({ where: { tenantId } });
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

test("reception books it in, and nothing leaves until the job card carries its five signatures", async () => {
    await assert.rejects(run((tx) => bookIn(tx, tenant, people.heavyForeman, job, place.reception)), /Only reception books/);
    await run((tx) => bookIn(tx, tenant, people.receptionist, job, place.reception));
    await assert.rejects(run((tx) => bookIn(tx, tenant, people.receptionist, job, place.reception)), /already booked in/);
    assert.ok((await open()).receivedAt, "received at reception on arrival");

    await sign("receptionist", { stage: "ISSUE", role: "RECEPTION" });
    await sign("receptionist", { stage: "ISSUE", role: "DRIVER", driver: { name: "Petrus Amukoto", payNumber: "PN-77120" } });
    await assert.rejects(send("receptionist", "ASSESSMENT", "check"), /needs signing by foreman, fleet coordinator, mechanic/);
    await assert.rejects(sign("receptionist", { stage: "ISSUE", role: "FOREMAN" }), /cannot sign as foreman|Another person/);
    await sign("heavyForeman", { stage: "ISSUE", role: "FOREMAN" });
    await sign("fleetCoordinator", { stage: "ISSUE", role: "FLEET_COORDINATOR" });
    await sign("artisan", { stage: "ISSUE", role: "MECHANIC" });
    const driver = await prisma.jobSignoff.findFirstOrThrow({ where: { documentId: job, role: "DRIVER" }, select: { name: true, payNumber: true, membershipId: true } });
    assert.deepEqual(driver, { name: "Petrus Amukoto", payNumber: "PN-77120", membershipId: null }, "the driver is named, not linked");
});

test("the check bay accepts it, assesses it, and it goes to a workshop only once assessed", async () => {
    await send("receptionist", "ASSESSMENT", "check");
    await assert.rejects(send("checkForeman", "WORK", "heavy"), /not been accepted/);
    await assert.rejects(accept("heavyForeman"), /Only somebody working at Check bay/);
    await accept("checkForeman");
    await assert.rejects(send("checkForeman", "WORK", "heavy"), /not signed the assessment/);
    await sign("checkForeman", { stage: "ASSESSMENT", role: "INSPECTOR", comment: "Hydraulic leak, rear left; tyres worn" });
    // The heavy duty foreman fetches it rather than waiting for the check bay to send it.
    await send("heavyForeman", "WORK", "heavy");
    await accept("heavyForeman");
    assert.equal((await open()).workshopId, place.heavy);
});

test("heavy duty sends it to the tyre bay; a failed quality check returns it there, and a pass releases it", async () => {
    await send("heavyForeman", "WORK", "tyres");
    await accept("tyreForeman");
    await send("tyreForeman", "QUALITY_CHECK", "check");
    await accept("checkForeman");
    await assert.rejects(sign("checkForeman", { stage: "QUALITY_CHECK", role: "INSPECTOR", decision: "FAILED" }), /Say what failed/);
    await sign("checkForeman", { stage: "QUALITY_CHECK", role: "INSPECTOR", decision: "FAILED", comment: "Wheel nuts not torqued" });
    await assert.rejects(send("checkForeman", "RELEASE", "reception"), /not passed/);
    await assert.rejects(send("checkForeman", "WORK", "heavy"), /back to the workshop that did the work/);
    await send("checkForeman", "WORK", "tyres");
    await accept("tyreForeman");
    await send("tyreForeman", "QUALITY_CHECK", "check");
    await accept("checkForeman");
    // The earlier failure belongs to the earlier check; this one must be signed on its own.
    await assert.rejects(send("checkForeman", "RELEASE", "reception"), /not passed/);
    await sign("checkForeman", { stage: "QUALITY_CHECK", role: "INSPECTOR", decision: "PASSED" });
    await send("checkForeman", "RELEASE", "reception");
    await accept("receptionist");
});

test("the driver and reception sign for collection, and the route closes", async () => {
    await assert.rejects(sign("receptionist", { stage: "COLLECTION", role: "DRIVER", driver: { name: " ", payNumber: null } }), /driver's name/);
    const first = await sign("driverClerk", { stage: "COLLECTION", role: "DRIVER", driver: { name: "Petrus Amukoto", payNumber: "PN-77120" } });
    assert.equal(first.collected, false);
    const second = await sign("receptionist", { stage: "COLLECTION", role: "RECEPTION" });
    assert.equal(second.collected, true);
    assert.equal(await prisma.jobVisit.count({ where: { documentId: job, leftAt: null } }), 0, "nowhere: it has been collected");
    const route = await prisma.jobVisit.findMany({ where: { documentId: job }, orderBy: { sentAt: "asc" }, select: { purpose: true } });
    assert.deepEqual(route.map((v) => v.purpose), ["INTAKE", "ASSESSMENT", "WORK", "WORK", "QUALITY_CHECK", "WORK", "QUALITY_CHECK", "RELEASE"]);
});

test("one vehicle is never in two places, even when two people send it at once", async () => {
    const second = (await prisma.document.create({ data: { tenantId: tenant.id, type: "JOB_CARD", jobNumber: "JC-9002" }, select: { id: true } })).id;
    await prisma.tenant.update({ where: { id: tenant.id }, data: { settings: { jobFlow: { issueRoles: ["RECEPTION"] } } } });
    tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    await run((tx) => bookIn(tx, tenant, people.receptionist, second, place.reception));
    await run((tx) => signJob(tx, tenant, people.receptionist, second, { stage: "ISSUE", role: "RECEPTION" }));
    const both = await Promise.allSettled([
        run((tx) => sendOn(tx, tenant, people.receptionist, second, { purpose: "ASSESSMENT", workshopId: place.check })),
        run((tx) => sendOn(tx, tenant, people.driverClerk, second, { purpose: "ASSESSMENT", workshopId: place.check })),
    ]);
    assert.equal(both.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(await prisma.jobVisit.count({ where: { documentId: second, leftAt: null } }), 1);
    await assert.rejects(
        prisma.jobVisit.create({ data: { tenantId: tenant.id, documentId: second, workshopId: place.heavy, purpose: "WORK" } }),
        /one_open_per_job|Unique constraint/,
        "and the database refuses a second open stay outright",
    );
});
