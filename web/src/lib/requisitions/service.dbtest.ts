import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient, type Designation, type Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { appRoleUrl, prepareAppRole } from "@/lib/testing/app-role";
import { sequenceAudit } from "@/lib/documents/gaps";
import {
    addQuote,
    cancelRequisition,
    decideRequisition,
    deleteDraft,
    finaliseRequisition,
    saveRequisition,
    signForPayer,
    submitRequisition,
    withdrawRequisition,
    type Actor,
    type FinalStep,
    type RequisitionInput,
} from "@/lib/requisitions/service";

/**
 * Requisitions against a real database, in the shape of the owner's council:
 * Technical Services runs the Fleet Management department and its workshops;
 * Community Services owns Parks, whose vehicles the workshop repairs.
 *
 * Numbered on first submission and never reused; approved by the workshop's
 * foreman and the divisional head found up the organisation; quotations by
 * the council's rule; the paying division's fleet coordinator told and
 * signing without holding anything up; finalised by three people, never two
 * boxes by one; one signature when two press at once; and the wall between
 * councils.
 */

const SLUG = "zztest-requisitions";
const PEOPLE = ["mechanic", "artisan", "foremanA", "foremanB", "head", "fleetTech", "fleetParks", "procurement", "tyreForeman", "partsDriver", "outsider"] as const;
type Person = (typeof PEOPLE)[number];
const DESIGNATIONS: Partial<Record<Person, Designation[]>> = {
    mechanic: ["MECHANIC"], artisan: ["ARTISAN"], foremanA: ["FOREMAN"], foremanB: ["FOREMAN"], head: ["DIVISION_HEAD"],
    fleetTech: ["FLEET_COORDINATOR"], fleetParks: ["FLEET_COORDINATOR"], tyreForeman: ["FOREMAN"], partsDriver: ["PARTS_DRIVER"],
};

let tenant: Tenant;
let otherId = "";
let appDb: PrismaClient;
const people = {} as Record<Person, Actor>;
const unit = { technical: "", fleet: "", community: "", parks: "" };
const shop = { heavy: "", tyres: "", carwash: "" };
const vote = { fleet: "", parks: "" };
const supplier: string[] = [];

const db = () => forTenant(tenant.id);
const run = <T,>(fn: (tx: Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0]) => Promise<T>) => db().$transaction(fn) as Promise<T>;
const draft = (over: Partial<RequisitionInput> = {}): RequisitionInput => ({
    kind: "STORES",
    workshopId: shop.heavy,
    location: "Bay 2",
    purpose: "Safety boots for the new apprentice",
    chargeDocumentId: null,
    chargeVoteId: vote.fleet,
    lines: [{ productId: null, description: "Safety boots, size 11", quantity: 1, unitCost: 450 }],
    ...over,
});
const raise = (who: Person, over: Partial<RequisitionInput> = {}) => run((tx) => saveRequisition(tx, tenant, people[who], null, draft(over)));
const submit = (who: Person, id: string) => run((tx) => submitRequisition(tx, tenant, people[who], id));
const decide = (who: Person, id: string, decision: "APPROVED" | "RETURNED" | "REJECTED", comment?: string) =>
    run((tx) => decideRequisition(tx, tenant, people[who], id, decision, comment));
const finalise = (who: Person, id: string, step: FinalStep) => run((tx) => finaliseRequisition(tx, tenant, people[who], id, step));
const row = (id: string) => prisma.requisition.findUniqueOrThrow({ where: { id }, select: { state: true, number: true, value: true, approvedAt: true, cancelReason: true } });
const signoffs = (id: string) =>
    prisma.requisitionSignoff.findMany({ where: { requisitionId: id }, orderBy: { at: "asc" }, select: { step: true, decision: true, name: true, role: true, payNumber: true, comment: true } });
const approved = async (id: string) => {
    await submit("mechanic", id);
    await decide("foremanA", id, "APPROVED");
    await decide("head", id, "APPROVED");
};

before(async () => {
    await prepareAppRole(prisma);
    tenant = await prisma.tenant.create({
        data: {
            status: "ACTIVE", slug: SLUG, name: "ZZTEST Council Workshop", country: "NA",
            settings: { requisitions: { overLimitAt: 50_000, quoteBands: [{ from: 0, quotes: 1 }, { from: 10_000, quotes: 3 }] } },
        },
    });
    otherId = (await prisma.tenant.create({ data: { status: "ACTIVE", slug: `${SLUG}-other`, name: "ZZTEST Other Council", country: "NA" }, select: { id: true } })).id;
    for (const p of PEOPLE) {
        const user = await prisma.user.create({ data: { email: `${SLUG}-${p}@example.invalid`, passwordHash: "x", firstName: p, lastName: "ZZTEST" }, select: { id: true } });
        const m = await prisma.membership.create({
            data: {
                tenantId: tenant.id, userId: user.id, status: "ACTIVE",
                group: p === "mechanic" || p === "artisan" ? "MECHANIC" : "FOREMAN",
                designations: DESIGNATIONS[p] ?? [], payNumber: p === "head" ? "PN-20431" : null,
            },
            select: { id: true },
        });
        people[p] = { membershipId: m.id, userId: user.id };
    }
    const orgUnit = (name: string, parentId: string | null = null) =>
        prisma.orgUnit.create({ data: { tenantId: tenant.id, name, parentId }, select: { id: true } }).then((u) => u.id);
    unit.technical = await orgUnit("Technical Services");
    unit.fleet = await orgUnit("Fleet Management", unit.technical);
    unit.community = await orgUnit("Community Services");
    unit.parks = await orgUnit("Parks", unit.community);
    const workshop = (name: string, kind: "WORKSHOP" | "BAY") =>
        prisma.workshop.create({ data: { tenantId: tenant.id, name, kind, orgUnitId: unit.fleet }, select: { id: true } }).then((w) => w.id);
    shop.heavy = await workshop("Heavy duty vehicles", "WORKSHOP");
    shop.tyres = await workshop("Tyre bay", "BAY");
    shop.carwash = await workshop("Carwash", "BAY");
    vote.fleet = (await prisma.vote.create({ data: { tenantId: tenant.id, orgUnitId: unit.fleet, code: "2000025105010", name: "Fleet: protective clothing" }, select: { id: true } })).id;
    vote.parks = (await prisma.vote.create({ data: { tenantId: tenant.id, orgUnitId: unit.parks, code: "2000031204020", name: "Parks: vehicle maintenance" }, select: { id: true } })).id;
    const appoint = (kind: "FOREMAN" | "DIVISION_HEAD" | "FLEET_COORDINATOR" | "OVER_LIMIT", who: Person, scope: { workshopId?: string; orgUnitId?: string } = {}, deputy = false) =>
        prisma.signingAuthority.create({ data: { tenantId: tenant.id, kind, membershipId: people[who].membershipId, workshopId: scope.workshopId ?? null, orgUnitId: scope.orgUnitId ?? null, deputy } });
    await appoint("FOREMAN", "foremanA", { workshopId: shop.heavy });
    await appoint("FOREMAN", "foremanB", { workshopId: shop.heavy }, true);
    await appoint("FOREMAN", "head", { workshopId: shop.heavy }, true);
    await appoint("FOREMAN", "tyreForeman", { workshopId: shop.tyres });
    // The head is appointed to the division; the workshops belong to a department under it.
    await appoint("DIVISION_HEAD", "head", { orgUnitId: unit.technical });
    await appoint("FLEET_COORDINATOR", "fleetTech", { orgUnitId: unit.technical });
    await appoint("FLEET_COORDINATOR", "fleetParks", { orgUnitId: unit.community });
    await appoint("OVER_LIMIT", "procurement");
    for (const name of ["Windhoek Truck Spares", "Auas Diesel", "Kalahari Hydraulics"]) {
        supplier.push((await prisma.supplier.create({ data: { tenantId: tenant.id, companyName: `ZZTEST ${name}` }, select: { id: true } })).id);
    }
    appDb = new PrismaClient({ datasourceUrl: appRoleUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    for (const tenantId of [tenant.id, otherId]) {
        await prisma.requisitionSignoff.deleteMany({ where: { tenantId } });
        await prisma.requisitionQuote.deleteMany({ where: { tenantId } });
        await prisma.requisitionLine.deleteMany({ where: { tenantId } });
        await prisma.requisition.updateMany({ where: { tenantId }, data: { sourceRequisitionId: null } });
        await prisma.requisition.deleteMany({ where: { tenantId } });
        await prisma.signingAuthority.deleteMany({ where: { tenantId } });
        await prisma.vote.deleteMany({ where: { tenantId } });
        await prisma.workshop.deleteMany({ where: { tenantId } });
        await prisma.orgUnit.deleteMany({ where: { tenantId, parentId: { not: null } } });
        await prisma.orgUnit.deleteMany({ where: { tenantId } });
        await prisma.supplier.deleteMany({ where: { tenantId } });
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
    await decide("foremanA", id, "RETURNED", "Order the composite toe cap, not steel.");
    assert.equal((await row(id)).state, "DRAFT");
    assert.equal((await submit("mechanic", id)).number, number, "submitted again under the same number");
    await run((tx) => cancelRequisition(tx, tenant, people.mechanic, id, "Bought by the apprentice's previous section"));
    assert.equal((await row(id)).number, number, "a cancelled requisition keeps its number");

    const second = (await submit("mechanic", await raise("mechanic"))).number;
    assert.equal(Number(second.slice(4)), Number(number.slice(4)) + 1, "the next one is the next number, with nothing skipped");
    const year = new Date().getUTCFullYear();
    const reqs = (await sequenceAudit(db(), new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31)))).find((a) => a.key === "REQUISITION");
    assert.ok(reqs, "requisitions are in the number-sequence report");
    assert.equal(reqs.gaps.filter((g) => !g.accounted).length, 0, "the cancelled one is not reported missing");
});

test("the workshop's foreman approves, then the divisional head found up the organisation, then above the limit the council's approver", async () => {
    const id = await raise("mechanic", { lines: [{ productId: null, description: "Hydraulic pump, TLB", quantity: 1, unitCost: 52_000 }] });
    await submit("mechanic", id);
    assert.equal((await decide("foremanA", id, "APPROVED")).state, "AWAITING_HEAD");
    assert.equal((await decide("head", id, "APPROVED", "Budget confirmed")).state, "AWAITING_OVER_LIMIT");
    assert.equal((await decide("procurement", id, "APPROVED")).state, "APPROVED");
    const trail = await signoffs(id);
    assert.deepEqual(trail.map((s) => s.step), ["REQUESTED", "FOREMAN", "DIVISIONAL_HEAD", "OVER_LIMIT"]);
    const head = trail.find((s) => s.step === "DIVISIONAL_HEAD")!;
    assert.deepEqual([head.name, head.role, head.payNumber, head.comment], ["head ZZTEST", "Divisional Head", "PN-20431", "Budget confirmed"]);

    const small = await raise("mechanic");
    await submit("mechanic", small);
    await decide("foremanA", small, "APPROVED");
    assert.equal((await decide("head", small, "APPROVED")).state, "APPROVED", "below the limit the head's is the last approval");
});

test("nobody signs their own requisition, nobody approves twice, and only those appointed sign at all", async () => {
    const own = await raise("foremanA");
    await submit("foremanA", own);
    await assert.rejects(decide("foremanA", own, "APPROVED"), /You raised this requisition/);
    await assert.rejects(decide("procurement", own, "APPROVED"), /not appointed to sign the foreman step/);
    await decide("head", own, "APPROVED"); // as deputy foreman
    assert.equal((await signoffs(own)).at(-1)!.role, "Foreman (deputy)", "a deputy's signature says so");
    await assert.rejects(decide("head", own, "APPROVED"), /already approved this requisition/);
    assert.equal((await row(own)).state, "AWAITING_HEAD", "still waiting on a second person");
});

test("a workshop's only foreman asking for it is recorded as such, and the divisional head signs next", async () => {
    const id = await raise("tyreForeman", { workshopId: shop.tyres });
    assert.equal((await submit("tyreForeman", id)).state, "AWAITING_HEAD");
    assert.deepEqual((await signoffs(id)).map((s) => s.decision), ["SUBMITTED", "RAISED_BY_FOREMAN"]);
});

test("nothing is submitted into a queue nobody reads, and no number is spent on trying", async () => {
    const id = await raise("mechanic", { workshopId: shop.carwash });
    await assert.rejects(submit("mechanic", id), /Nobody is appointed to sign the foreman step for this workshop/);
    assert.equal((await row(id)).number, null);
});

test("returning and rejecting need a reason, and two approvers pressing at once sign once", async () => {
    const id = await raise("mechanic");
    await submit("mechanic", id);
    await assert.rejects(decide("foremanA", id, "REJECTED"), /reason/);
    const results = await Promise.allSettled([decide("foremanA", id, "APPROVED"), decide("foremanB", id, "APPROVED")]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal((await signoffs(id)).filter((s) => s.decision === "APPROVED").length, 1);
});

test("a purchase requisition carries the quotations the council's rule asks for, and is approved at the one chosen", async () => {
    const stores = await raise("mechanic", { chargeVoteId: null, chargeDocumentId: null, purpose: "Pump for the TLB" });
    const id = await raise("mechanic", { kind: "PURCHASE", sourceRequisitionId: stores, lines: [{ productId: null, description: "Hydraulic pump, TLB", quantity: 1, unitCost: 11_000 }] });
    const quote = (who: Person, i: number, amount: number) => run((tx) => addQuote(tx, tenant, people[who], id, { supplierId: supplier[i], amount, reference: `Q-${i}` }));

    await assert.rejects(quote("outsider", 0, 12_400), /parts driver/);
    await quote("partsDriver", 0, 12_400);
    await quote("partsDriver", 1, 12_950);
    // The first one in is put forward, so the council's rule is read at its price straight away.
    await assert.rejects(submit("mechanic", id), /needs 3 quotations\. It has 2/);
    await quote("partsDriver", 2, 13_100);

    await submit("mechanic", id);
    const after = await row(id);
    assert.equal(after.state, "AWAITING_FOREMAN");
    assert.equal(after.value.toNumber(), 12_400, "valued at the quotation chosen, not the estimate");
    await assert.rejects(quote("partsDriver", 1, 11_000), /can no longer change/);

    await assert.rejects(raise("mechanic", { sourceRequisitionId: stores }), /Only a purchase requisition is split/);
});

test("the paying division's fleet coordinator is told, may approve against the vote or witness it, and holds nothing up", async () => {
    const id = await raise("mechanic", { chargeVoteId: vote.parks, purpose: "Wheel bearing, Parks bakkie" });
    await submit("mechanic", id);
    await assert.rejects(run((tx) => signForPayer(tx, tenant, people.fleetParks, id, "APPROVED")), /not approved it yet/);
    await decide("foremanA", id, "APPROVED");
    await decide("head", id, "APPROVED");
    await assert.rejects(run((tx) => signForPayer(tx, tenant, people.fleetTech, id, "APPROVED")), /division that pays/);
    await run((tx) => signForPayer(tx, tenant, people.fleetParks, id, "WITNESSED", "Within the Parks vote"));
    await assert.rejects(run((tx) => signForPayer(tx, tenant, people.fleetParks, id, "APPROVED")), /already signed/);
    assert.equal((await row(id)).state, "APPROVED", "the payer's signature changes nothing about where it stands");
    assert.equal((await signoffs(id)).at(-1)!.decision, "WITNESSED");
});

test("finalising takes the foreman, the paying division's fleet coordinator and the divisional head; the fitter may sign; nobody signs two boxes", async () => {
    const id = await raise("mechanic", { chargeVoteId: vote.parks });
    await approved(id);
    await assert.rejects(finalise("foremanA", id, "FINAL_FOREMAN"), /not waiting to be finalised/);
    await prisma.requisition.update({ where: { id }, data: { state: "AWAITING_FINALISE" } }); // what issuing everything will do

    await finalise("foremanA", id, "FINAL_FOREMAN");
    await assert.rejects(finalise("foremanA", id, "FINAL_DIVISIONAL_HEAD"), /already signed it as foreman/);
    await assert.rejects(finalise("outsider", id, "FINAL_FITTER"), /mechanic, artisan or intern/);
    await finalise("artisan", id, "FINAL_FITTER");
    await assert.rejects(finalise("fleetTech", id, "FINAL_FLEET_COORDINATOR"), /not appointed to sign as fleet coordinator/);
    assert.equal((await row(id)).state, "AWAITING_FINALISE");

    // The last two sign at the same moment; exactly one of them closes it.
    const both = await Promise.allSettled([finalise("fleetParks", id, "FINAL_FLEET_COORDINATOR"), finalise("head", id, "FINAL_DIVISIONAL_HEAD")]);
    assert.deepEqual(both.map((r) => r.status), ["fulfilled", "fulfilled"]);
    assert.equal((await row(id)).state, "CLOSED");
    assert.equal(await prisma.auditEvent.count({ where: { entityId: id, action: "FINALISED" } }), 1);
});

test("only a draft changes, only its requester changes it, and a numbered draft cannot be deleted", async () => {
    const id = await raise("mechanic");
    await assert.rejects(run((tx) => saveRequisition(tx, tenant, people.foremanA, id, draft())), /Only the person who raised it/);
    await submit("mechanic", id);
    await assert.rejects(run((tx) => saveRequisition(tx, tenant, people.mechanic, id, draft())), /no longer be changed/);
    await run((tx) => withdrawRequisition(tx, tenant, people.mechanic, id));
    await run((tx) => saveRequisition(tx, tenant, people.mechanic, id, draft({ location: "Bay 3" })));
    await assert.rejects(run((tx) => saveRequisition(tx, tenant, people.mechanic, id, draft({ kind: "PURCHASE" }))), /stays the kind/);
    await assert.rejects(run((tx) => deleteDraft(tx, tenant, people.mechanic, id)), /has a number/);
    const fresh = await raise("mechanic");
    await run((tx) => deleteDraft(tx, tenant, people.mechanic, fresh));
    assert.equal(await prisma.requisition.findUnique({ where: { id: fresh } }), null, "a draft never submitted can go");
});

test("after approval only an owner or admin cancels it", async () => {
    const id = await raise("mechanic");
    await approved(id);
    await assert.rejects(run((tx) => cancelRequisition(tx, tenant, people.mechanic, id, "No longer needed")), /only an owner or admin/);
    await run((tx) => cancelRequisition(tx, tenant, { ...people.outsider, canManage: true }, id, "Duplicate of an earlier requisition"));
    assert.equal((await row(id)).cancelReason, "Duplicate of an earlier requisition");
});

test("a council sees its own requisitions and organisation, and no other council's", async () => {
    assert.ok((await db().requisition.count()) > 0);
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
        (tx: PrismaClient) => tx.requisitionQuote.count({ where: scope }),
        (tx: PrismaClient) => tx.signingAuthority.count({ where: scope }),
        (tx: PrismaClient) => tx.orgUnit.count({ where: scope }),
        (tx: PrismaClient) => tx.workshop.count({ where: scope }),
        (tx: PrismaClient) => tx.vote.count({ where: scope }),
    ]) {
        assert.equal(await inTx({ "motion.tenant_id": otherId }, read), 0);
        assert.equal(await inTx({}, read), 0, "with no workshop announced, nothing");
        assert.ok((await inTx({ "motion.tenant_id": tenant.id }, read)) > 0);
    }
});
