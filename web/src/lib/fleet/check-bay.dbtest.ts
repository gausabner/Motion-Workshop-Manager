import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Designation, Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { acceptVisit, bookIn, sendOn, signJob, type Actor } from "@/lib/fleet/route";
import { startCheck } from "@/lib/fleet/check-bay";

/**
 * The check bay's two inspections against a real database: the assessment's
 * findings land on the job card as its work when it is signed; a quality
 * check with a red item fails, says what failed, and sends the vehicle back
 * to the workshop in the same move; a clean one passes.
 */

const SLUG = "zztest-checkbay";
const PEOPLE = ["receptionist", "checkForeman", "heavyForeman"] as const;
type Who = (typeof PEOPLE)[number];
const DESIGNATIONS: Record<Who, Designation[]> = { receptionist: ["RECEPTION"], checkForeman: ["FOREMAN"], heavyForeman: ["FOREMAN"] };

let tenant: Tenant;
let job = "";
const people = {} as Record<Who, Actor>;
const place = { reception: "", check: "", heavy: "" };

const db = () => forTenant(tenant.id);
const run = <T,>(fn: (tx: Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0]) => Promise<T>) => db().$transaction(fn) as Promise<T>;
const send = (who: Who, purpose: "ASSESSMENT" | "WORK" | "QUALITY_CHECK" | "RELEASE", to: keyof typeof place) => run((tx) => sendOn(tx, tenant, people[who], job, { purpose, workshopId: place[to] }));
const open = () => prisma.jobVisit.findFirstOrThrow({ where: { documentId: job, leftAt: null }, select: { id: true, workshopId: true, purpose: true, receivedAt: true } });
const accept = async (who: Who) => run(async (tx) => acceptVisit(tx, tenant, people[who], (await open()).id));
const sign = (who: Who, input: Parameters<typeof signJob>[4]) => run((tx) => signJob(tx, tenant, people[who], job, input));
const start = (who: Who) => run((tx) => startCheck(tx, tenant, people[who], job));
/** Mark the inspection's items in order: ok, soon or urgent, with an optional comment. */
async function mark(inspectionId: string, marks: ["ok" | "soon" | "urgent", string?][]) {
    const items = await prisma.inspectionItem.findMany({ where: { inspectionId }, orderBy: { ordering: "asc" }, select: { id: true } });
    for (const [n, [m, comment]] of marks.entries()) {
        await prisma.inspectionItem.update({ where: { id: items[n].id }, data: { checked: true, soon: m === "soon", urgent: m === "urgent", comment: comment ?? null, estimate: m === "ok" ? null : 450 } });
    }
}

before(async () => {
    tenant = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Check Bay Council", country: "NA" } });
    for (const p of PEOPLE) {
        const user = await prisma.user.create({ data: { email: `${SLUG}-${p}@example.invalid`, passwordHash: "x", firstName: p, lastName: "ZZTEST" }, select: { id: true } });
        const m = await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, group: "FOREMAN", status: "ACTIVE", designations: DESIGNATIONS[p], payNumber: `PN-${p.length}` }, select: { id: true } });
        people[p] = { membershipId: m.id, userId: user.id };
    }
    const unit = (await prisma.orgUnit.create({ data: { tenantId: tenant.id, name: "Fleet Management" }, select: { id: true } })).id;
    const ws = (name: string, kind: "RECEPTION" | "CHECK_BAY" | "WORKSHOP") => prisma.workshop.create({ data: { tenantId: tenant.id, name, kind, orgUnitId: unit }, select: { id: true } }).then((w) => w.id);
    place.reception = await ws("Reception", "RECEPTION");
    place.check = await ws("Check bay", "CHECK_BAY");
    place.heavy = await ws("Heavy duty vehicles", "WORKSHOP");
    await prisma.signingAuthority.create({ data: { tenantId: tenant.id, kind: "FOREMAN", workshopId: place.check, membershipId: people.checkForeman.membershipId } });
    await prisma.signingAuthority.create({ data: { tenantId: tenant.id, kind: "FOREMAN", workshopId: place.heavy, membershipId: people.heavyForeman.membershipId } });
    const template = (name: string, items: string[]) =>
        prisma.inspectionTemplate.create({ data: { tenantId: tenant.id, name, items: { create: items.map((description, ordering) => ({ tenantId: tenant.id, group: "Vehicle", description, ordering })) } }, select: { id: true } }).then((t) => t.id);
    const assessmentTemplateId = await template("Fleet assessment", ["Brakes", "Hydraulics", "Lights"]);
    const qualityTemplateId = await template("Fleet quality check", ["Wheel nuts torqued", "No new damage", "Work on the job card done"]);
    tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: { settings: { jobFlow: { issueRoles: ["RECEPTION"], assessmentTemplateId, qualityTemplateId } } } });
    job = (await prisma.document.create({ data: { tenantId: tenant.id, type: "JOB_CARD", jobNumber: "JC-9101", jobStatus: "BOOKED_IN" }, select: { id: true } })).id;
});

after(async () => {
    const tenantId = tenant.id;
    await prisma.inspectionItem.deleteMany({ where: { tenantId } });
    await prisma.inspection.deleteMany({ where: { tenantId } });
    await prisma.documentLine.deleteMany({ where: { tenantId } });
    await prisma.jobSignoff.deleteMany({ where: { tenantId } });
    await prisma.jobVisit.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.signingAuthority.deleteMany({ where: { tenantId } });
    await prisma.inspectionTemplateItem.deleteMany({ where: { tenantId } });
    await prisma.inspectionTemplate.deleteMany({ where: { tenantId } });
    await prisma.workshop.deleteMany({ where: { tenantId } });
    await prisma.orgUnit.deleteMany({ where: { tenantId } });
    await prisma.sequence.deleteMany({ where: { tenantId } });
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("the assessment is an inspection: started once per stay, signed only when finished, and its findings become the work", async () => {
    await run((tx) => bookIn(tx, tenant, people.receptionist, job, place.reception));
    await sign("receptionist", { stage: "ISSUE", role: "RECEPTION" });
    await send("receptionist", "ASSESSMENT", "check");
    await assert.rejects(start("checkForeman"), /Accept it at Check bay first/);
    await accept("checkForeman");

    await assert.rejects(sign("checkForeman", { stage: "ASSESSMENT", role: "INSPECTOR", comment: "Looks fine" }), /Start the assessment first/);
    await assert.rejects(start("heavyForeman"), /Only somebody working at Check bay/);
    const first = await start("checkForeman");
    assert.deepEqual(await start("checkForeman"), first, "a second start opens the same inspection");
    const inspection = await prisma.inspection.findUniqueOrThrow({ where: { id: first.id }, select: { purpose: true, visitId: true, _count: { select: { items: true } } } });
    assert.deepEqual(inspection, { purpose: "ASSESSMENT", visitId: (await open()).id, _count: { items: 3 } });

    await assert.rejects(sign("checkForeman", { stage: "ASSESSMENT", role: "INSPECTOR" }), /3 of 3 are not checked/);
    await mark(first.id, [["urgent", "2 mm left"], ["soon"], ["ok"]]);
    await sign("checkForeman", { stage: "ASSESSMENT", role: "INSPECTOR", comment: "Driver reports a pull to the left" });

    const signature = await prisma.jobSignoff.findFirstOrThrow({ where: { documentId: job, stage: "ASSESSMENT" }, select: { comment: true, decision: true } });
    assert.deepEqual(signature, { decision: "SIGNED", comment: "1 urgent, 1 soon: Brakes: 2 mm left; Hydraulics. Driver reports a pull to the left" });
    const lines = await prisma.documentLine.findMany({ where: { documentId: job }, orderBy: { sortOrder: "asc" }, select: { description: true } });
    assert.deepEqual(lines.map((l) => l.description), ["Brakes — 2 mm left", "Hydraulics"], "the red and amber findings are the job card's work");
    const closed = await prisma.inspection.findUniqueOrThrow({ where: { id: first.id }, select: { state: true, items: { where: { approvedAt: { not: null } }, select: { approvedBy: true } } } });
    assert.equal(closed.state, "FINALISED");
    assert.deepEqual(closed.items.map((i) => i.approvedBy), ["checkForeman ZZTEST", "checkForeman ZZTEST"], "approved by the person who signed");
});

test("a quality check with a red item fails, says what failed, and goes back to the workshop in one move", async () => {
    await send("heavyForeman", "WORK", "heavy");
    await accept("heavyForeman");
    await send("heavyForeman", "QUALITY_CHECK", "check");
    await accept("checkForeman");
    const qc = await start("checkForeman");
    assert.equal((await prisma.inspection.findUniqueOrThrow({ where: { id: qc.id }, select: { purpose: true } })).purpose, "QUALITY_CHECK");
    await mark(qc.id, [["urgent", "not torqued"], ["ok"], ["ok"]]);
    // The inspection decides: a "passed" chosen by hand does not override a red item.
    await sign("checkForeman", { stage: "QUALITY_CHECK", role: "INSPECTOR", decision: "PASSED", returnToWork: true });

    const failed = await prisma.jobSignoff.findFirstOrThrow({ where: { documentId: job, stage: "QUALITY_CHECK" }, select: { decision: true, comment: true } });
    assert.deepEqual(failed, { decision: "FAILED", comment: "Wheel nuts torqued: not torqued" });
    const now = await open();
    assert.deepEqual({ at: now.workshopId, purpose: now.purpose, received: !!now.receivedAt }, { at: place.heavy, purpose: "WORK", received: false }, "on its way back to heavy duty");
});

test("a clean quality check passes, cannot be sent back, and the vehicle is released", async () => {
    await accept("heavyForeman");
    await send("heavyForeman", "QUALITY_CHECK", "check");
    await accept("checkForeman");
    const qc = await start("checkForeman");
    await mark(qc.id, [["ok"], ["ok"], ["soon", "Paint chipped on the step, not ours"]]);
    await assert.rejects(sign("checkForeman", { stage: "QUALITY_CHECK", role: "INSPECTOR", returnToWork: true }), /It passed/);
    await sign("checkForeman", { stage: "QUALITY_CHECK", role: "INSPECTOR" });
    const passed = await prisma.jobSignoff.findFirstOrThrow({ where: { documentId: job, stage: "QUALITY_CHECK", decision: "PASSED" }, select: { comment: true } });
    assert.equal(passed.comment, "3 items checked");
    await send("checkForeman", "RELEASE", "reception");
    assert.equal(await prisma.inspection.count({ where: { documentId: job, purpose: { not: "GENERAL" } } }), 3, "one inspection for each check bay stay");
});
