import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, type Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { appRoleUrl, prepareAppRole } from "@/lib/testing/app-role";
import { sequenceAudit } from "@/lib/documents/gaps";
import {
    cancelRequisition,
    decideRequisition,
    deleteDraft,
    saveRequisition,
    submitRequisition,
    withdrawRequisition,
    type Actor,
    type RequisitionInput,
} from "@/lib/requisitions/service";

/**
 * Requisitions against a real database: numbered on first submission and
 * never reused, signed in the form's order by the people assigned to each
 * step, never by the requester and never twice by one person, one signature
 * when two approvers press at once, and the wall between councils.
 */

const SLUG = "zztest-requisitions";
const PEOPLE = ["mechanic", "foremanA", "foremanB", "head", "procurement", "parksForeman", "parksHead", "outsider"] as const;
type Person = (typeof PEOPLE)[number];

let tenant: Tenant;
let otherId = "";
let appDb: PrismaClient;
const people = {} as Record<Person, Actor>;
const dept = { workshop: "", parks: "", stores: "" };
let voteId = "";

const db = () => forTenant(tenant.id);
const run = <T,>(fn: Parameters<ReturnType<typeof db>["$transaction"]>[0] extends (tx: infer X) => unknown ? (tx: X) => Promise<T> : never) =>
    db().$transaction(fn) as Promise<T>;
const draft = (over: Partial<RequisitionInput> = {}): RequisitionInput => ({
    departmentId: dept.workshop,
    location: "Workshop bay 2",
    purpose: "Safety boots for the new apprentice",
    chargeDocumentId: null,
    chargeVoteId: voteId,
    lines: [{ productId: null, description: "Safety boots, size 11", quantity: 1, unitCost: 450 }],
    ...over,
});
const raise = (who: Person, over: Partial<RequisitionInput> = {}) => run((tx) => saveRequisition(tx, tenant, people[who], null, draft(over)));
const submit = (who: Person, id: string) => run((tx) => submitRequisition(tx, tenant, people[who], id));
const decide = (who: Person, id: string, decision: "APPROVED" | "RETURNED" | "REJECTED", comment?: string) =>
    run((tx) => decideRequisition(tx, tenant, people[who], id, decision, comment));
const row = (id: string) => prisma.requisition.findUniqueOrThrow({ where: { id }, select: { state: true, number: true, approvedAt: true, cancelReason: true } });
const signoffs = (id: string) =>
    prisma.requisitionSignoff.findMany({ where: { requisitionId: id }, orderBy: { at: "asc" }, select: { step: true, decision: true, name: true, role: true, payNumber: true, comment: true } });

before(async () => {
    await prepareAppRole(prisma);
    tenant = await prisma.tenant.create({
        data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Council Workshop", country: "NA", settings: { requisitions: { overLimitAt: 10_000 } } },
    });
    otherId = (await prisma.tenant.create({ data: { status: "ACTIVE", slug: `${SLUG}-other`, name: "ZZTEST Other Council", country: "NA" }, select: { id: true } })).id;
    for (const p of PEOPLE) {
        const user = await prisma.user.create({ data: { email: `${SLUG}-${p}@example.invalid`, passwordHash: "x", firstName: p, lastName: "ZZTEST" }, select: { id: true } });
        const m = await prisma.membership.create({
            data: { tenantId: tenant.id, userId: user.id, group: p === "mechanic" ? "MECHANIC" : "FOREMAN", status: "ACTIVE", payNumber: p === "head" ? "PN-20431" : null },
            select: { id: true },
        });
        people[p] = { membershipId: m.id, userId: user.id };
    }
    dept.workshop = (await prisma.department.create({ data: { tenantId: tenant.id, name: "Mechanical Workshop" }, select: { id: true } })).id;
    dept.parks = (await prisma.department.create({ data: { tenantId: tenant.id, name: "Parks" }, select: { id: true } })).id;
    dept.stores = (await prisma.department.create({ data: { tenantId: tenant.id, name: "Stores" }, select: { id: true } })).id;
    voteId = (await prisma.vote.create({ data: { tenantId: tenant.id, code: "2000025105010", name: "Protective clothing" }, select: { id: true } })).id;
    const assign = (step: "FOREMAN" | "DIVISIONAL_HEAD" | "OVER_LIMIT", who: Person, departmentId: string | null, deputy = false) =>
        prisma.requisitionApprover.create({ data: { tenantId: tenant.id, step, departmentId, membershipId: people[who].membershipId, deputy } });
    await assign("FOREMAN", "foremanA", dept.workshop);
    await assign("FOREMAN", "foremanB", dept.workshop, true);
    await assign("FOREMAN", "head", dept.workshop, true);
    await assign("DIVISIONAL_HEAD", "head", dept.workshop);
    await assign("FOREMAN", "parksForeman", dept.parks);
    await assign("DIVISIONAL_HEAD", "parksHead", dept.parks);
    await assign("OVER_LIMIT", "procurement", null);
    appDb = new PrismaClient({ datasourceUrl: appRoleUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    for (const tenantId of [tenant.id, otherId]) {
        await prisma.requisitionSignoff.deleteMany({ where: { tenantId } });
        await prisma.requisitionLine.deleteMany({ where: { tenantId } });
        await prisma.requisition.deleteMany({ where: { tenantId } });
        await prisma.requisitionApprover.deleteMany({ where: { tenantId } });
        await prisma.department.deleteMany({ where: { tenantId } });
        await prisma.vote.deleteMany({ where: { tenantId } });
        await prisma.auditEvent.deleteMany({ where: { tenantId } });
        await prisma.sequence.deleteMany({ where: { tenantId } });
        await prisma.membership.deleteMany({ where: { tenantId } });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("a requisition is numbered when first submitted, and keeps the number when returned or cancelled", async () => {
    const id = await raise("mechanic");
    assert.equal((await row(id)).number, null, "a draft has no number");

    const { number } = await submit("mechanic", id);
    assert.match(number, /^REQ-\d+$/);
    assert.equal((await row(id)).state, "AWAITING_FOREMAN");

    await decide("foremanA", id, "RETURNED", "Order the composite toe cap, not steel.");
    assert.deepEqual(await row(id), { state: "DRAFT", number, approvedAt: null, cancelReason: null });
    assert.equal((await submit("mechanic", id)).number, number, "submitted again under the same number");

    await run((tx) => cancelRequisition(tx, tenant, people.mechanic, id, "Bought by the apprentice's previous section"));
    assert.equal((await row(id)).state, "CANCELLED");
    assert.equal((await row(id)).number, number, "a cancelled requisition keeps its number");

    const next = await raise("mechanic");
    const second = (await submit("mechanic", next)).number;
    assert.equal(Number(second.slice(4)), Number(number.slice(4)) + 1, "the next one is the next number, with nothing skipped");

    const year = new Date();
    const audit = await sequenceAudit(db(), new Date(Date.UTC(year.getUTCFullYear(), 0, 1)), new Date(Date.UTC(year.getUTCFullYear(), 11, 31)));
    const reqs = audit.find((a) => a.key === "REQUISITION");
    assert.ok(reqs, "requisitions are in the number-sequence report");
    assert.equal(reqs.gaps.filter((g) => !g.accounted).length, 0, "the cancelled one is not reported missing");
});

test("the foreman, then the divisional head sign; above the limit, the council's approver too", async () => {
    const id = await raise("mechanic", { lines: [{ productId: null, description: "Hydraulic pump, TLB", quantity: 1, unitCost: 12_500 }] });
    await submit("mechanic", id);
    assert.equal((await decide("foremanA", id, "APPROVED")).state, "AWAITING_HEAD");
    assert.equal((await decide("head", id, "APPROVED", "Budget confirmed")).state, "AWAITING_OVER_LIMIT");
    assert.equal((await decide("procurement", id, "APPROVED")).state, "APPROVED");
    assert.ok((await row(id)).approvedAt);

    const trail = await signoffs(id);
    assert.deepEqual(trail.map((s) => [s.step, s.decision]), [
        ["REQUESTED", "SUBMITTED"], ["FOREMAN", "APPROVED"], ["DIVISIONAL_HEAD", "APPROVED"], ["OVER_LIMIT", "APPROVED"],
    ]);
    const head = trail.find((s) => s.step === "DIVISIONAL_HEAD")!;
    assert.deepEqual([head.name, head.role, head.payNumber, head.comment], ["head ZZTEST", "Divisional Head", "PN-20431", "Budget confirmed"]);
});

test("below the limit, the divisional head's signature is the last", async () => {
    const id = await raise("mechanic");
    await submit("mechanic", id);
    await decide("foremanA", id, "APPROVED");
    assert.equal((await decide("head", id, "APPROVED")).state, "APPROVED");
});

test("nobody signs their own requisition, nobody signs two steps, and only those assigned sign at all", async () => {
    const own = await raise("foremanA");
    await submit("foremanA", own);
    await assert.rejects(decide("foremanA", own, "APPROVED"), /You raised this requisition/);
    await assert.rejects(decide("procurement", own, "APPROVED"), /not assigned to sign the foreman step/);
    // The head is also a deputy foreman. Having signed as foreman, they cannot sign as head as well.
    await decide("head", own, "APPROVED");
    const trail = await signoffs(own);
    assert.equal(trail.at(-1)!.role, "Foreman (deputy)", "a deputy's signature says so");
    await assert.rejects(decide("head", own, "APPROVED"), /already signed this requisition/);
    assert.equal((await row(own)).state, "AWAITING_HEAD", "still waiting on a second person");
});

test("a section's only foreman asking for it is recorded as such, and the divisional head signs next", async () => {
    const id = await raise("parksForeman", { departmentId: dept.parks });
    assert.equal((await submit("parksForeman", id)).state, "AWAITING_HEAD");
    const trail = await signoffs(id);
    assert.deepEqual(trail.map((s) => s.decision), ["SUBMITTED", "RAISED_BY_FOREMAN"]);
    assert.equal((await decide("parksHead", id, "APPROVED")).state, "APPROVED");
});

test("nothing is submitted into a queue nobody reads", async () => {
    const id = await raise("mechanic", { departmentId: dept.stores });
    await assert.rejects(submit("mechanic", id), /Nobody is assigned to sign the foreman step/);
    assert.equal((await row(id)).number, null, "no number is spent on a refused submission");
});

test("returning and rejecting need a reason, and a rejected requisition is closed", async () => {
    const id = await raise("mechanic");
    await submit("mechanic", id);
    await assert.rejects(decide("foremanA", id, "REJECTED"), /reason/);
    assert.equal((await decide("foremanA", id, "REJECTED", "Issued on a previous requisition")).state, "REJECTED");
    await assert.rejects(decide("head", id, "APPROVED"), /not waiting on a signature/);
});

test("two approvers pressing at once sign once", async () => {
    const id = await raise("mechanic");
    await submit("mechanic", id);
    const results = await Promise.allSettled([decide("foremanA", id, "APPROVED"), decide("foremanB", id, "APPROVED")]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await signoffs(id)).filter((s) => s.decision === "APPROVED").length, 1);
});

test("only a draft changes, only its requester changes it, and a numbered draft cannot be deleted", async () => {
    const id = await raise("mechanic");
    await assert.rejects(run((tx) => saveRequisition(tx, tenant, people.foremanA, id, draft())), /Only the person who raised it/);
    await submit("mechanic", id);
    await assert.rejects(run((tx) => saveRequisition(tx, tenant, people.mechanic, id, draft())), /no longer be changed/);

    await run((tx) => withdrawRequisition(tx, tenant, people.mechanic, id));
    assert.equal((await row(id)).state, "DRAFT");
    await run((tx) => saveRequisition(tx, tenant, people.mechanic, id, draft({ lines: [{ productId: null, description: "Safety boots, size 10", quantity: 1, unitCost: 450 }] })));
    await assert.rejects(run((tx) => deleteDraft(tx, tenant, people.mechanic, id)), /has a number/);

    const fresh = await raise("mechanic");
    await run((tx) => deleteDraft(tx, tenant, people.mechanic, fresh));
    assert.equal(await prisma.requisition.findUnique({ where: { id: fresh } }), null, "a draft never submitted can go");
});

test("after approval only an owner or admin cancels it", async () => {
    const id = await raise("mechanic");
    await submit("mechanic", id);
    await decide("foremanA", id, "APPROVED");
    await decide("head", id, "APPROVED");
    await assert.rejects(run((tx) => cancelRequisition(tx, tenant, people.mechanic, id, "No longer needed")), /only an owner or admin/);
    await run((tx) => cancelRequisition(tx, tenant, { ...people.outsider, canManage: true }, id, "Duplicate of an earlier requisition"));
    assert.equal((await row(id)).cancelReason, "Duplicate of an earlier requisition");
});

test("a council sees its own requisitions and no other council's", async () => {
    const mine = await db().requisition.count();
    assert.ok(mine > 0);
    assert.equal(await forTenant(otherId).requisition.count(), 0);

    const inTx = <T,>(settings: Record<string, string>, fn: (tx: PrismaClient) => Promise<T>) =>
        appDb.$transaction(async (tx) => {
            for (const [k, v] of Object.entries(settings)) await tx.$executeRawUnsafe(`SELECT set_config($1, $2, true)`, k, v);
            return fn(tx as unknown as PrismaClient);
        });
    const scope = { tenantId: { in: [tenant.id, otherId] } };
    for (const read of [
        (tx: PrismaClient) => tx.requisition.count({ where: scope }),
        (tx: PrismaClient) => tx.requisitionSignoff.count({ where: scope }),
        (tx: PrismaClient) => tx.requisitionApprover.count({ where: scope }),
        (tx: PrismaClient) => tx.vote.count({ where: scope }),
    ]) {
        assert.equal(await inTx({ "motion.tenant_id": otherId }, read), 0);
        assert.equal(await inTx({}, read), 0, "with no workshop announced, nothing");
        assert.ok((await inTx({ "motion.tenant_id": tenant.id }, read)) > 0);
    }
});
