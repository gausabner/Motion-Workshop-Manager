import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Designation, Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { postDocumentStock } from "@/lib/stock/ledger";
import { decideRequisition, finaliseRequisition, saveRequisition, submitRequisition, type Actor } from "@/lib/requisitions/service";
import { issueStores } from "@/lib/requisitions/stores";

/**
 * A stores requisition on a job card, against a real database: raised by the
 * mechanic, the job card waiting for parts while it is open, approved by the
 * foreman and the divisional head, issued by stores in two handovers to a
 * named receiver, the parts on the job card at cost, the stock off the shelf
 * once — and not again when the job card's invoice is processed — and
 * finalised by the three who must sign.
 */

const SLUG = "zztest-stores";
const PEOPLE = ["mechanic", "foreman", "head", "storeman", "coordinator"] as const;
type Who = (typeof PEOPLE)[number];
const DESIGNATIONS: Record<Who, Designation[]> = { mechanic: ["MECHANIC"], foreman: ["FOREMAN"], head: ["DIVISION_HEAD"], storeman: ["STOREMAN"], coordinator: ["FLEET_COORDINATOR"] };

let tenant: Tenant;
let job = "";
let product = "";
let req = "";
let workshop = "";
const people = {} as Record<Who, Actor>;

const db = () => forTenant(tenant.id);
const run = <T,>(fn: (tx: Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0]) => Promise<T>) => db().$transaction(fn) as Promise<T>;
const issue = (who: Who, quantity: number, receiver: { membershipId?: string | null; name?: string; payNumber?: string }) =>
    run(async (tx) => {
        const line = await tx.requisitionLine.findFirstOrThrow({ where: { requisitionId: req }, select: { id: true } });
        return issueStores(tx, tenant, { ...people[who], canIssue: who === "storeman" }, req, { lines: [{ lineId: line.id, quantity }], receiver: { membershipId: receiver.membershipId ?? null, name: receiver.name, payNumber: receiver.payNumber } });
    });
const jobStatus = async () => (await prisma.document.findUniqueOrThrow({ where: { id: job }, select: { jobStatus: true } })).jobStatus;
const onHand = async () => (await prisma.product.findUniqueOrThrow({ where: { id: product }, select: { qtyOnHand: true } })).qtyOnHand.toNumber();

before(async () => {
    tenant = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Stores Council", country: "NA", salesTaxRate: "15.00" } });
    for (const p of PEOPLE) {
        const user = await prisma.user.create({ data: { email: `${SLUG}-${p}@example.invalid`, passwordHash: "x", firstName: p, lastName: "ZZTEST" }, select: { id: true } });
        const m = await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, group: "FOREMAN", status: "ACTIVE", designations: DESIGNATIONS[p], payNumber: `PN-${p}` }, select: { id: true } });
        people[p] = { membershipId: m.id, userId: user.id };
    }
    const division = (await prisma.orgUnit.create({ data: { tenantId: tenant.id, name: "Technical Services" }, select: { id: true } })).id;
    const fleet = (await prisma.orgUnit.create({ data: { tenantId: tenant.id, name: "Fleet Management", parentId: division }, select: { id: true } })).id;
    workshop = (await prisma.workshop.create({ data: { tenantId: tenant.id, name: "Heavy duty vehicles", kind: "WORKSHOP", orgUnitId: fleet }, select: { id: true } })).id;
    const appoint = (kind: "FOREMAN" | "DIVISION_HEAD" | "FLEET_COORDINATOR", who: Who, scope: { workshopId?: string; orgUnitId?: string }) =>
        prisma.signingAuthority.create({ data: { tenantId: tenant.id, kind, membershipId: people[who].membershipId, workshopId: scope.workshopId ?? null, orgUnitId: scope.orgUnitId ?? null } });
    await appoint("FOREMAN", "foreman", { workshopId: workshop });
    await appoint("DIVISION_HEAD", "head", { orgUnitId: division });
    await appoint("FLEET_COORDINATOR", "coordinator", { orgUnitId: division });
    product = (await prisma.product.create({ data: { tenantId: tenant.id, itemCode: "BP-HD-01", description: "Brake pads, heavy duty, axle set", type: "STOCK", qtyOnHand: 10, costExTax: 1200, retailPrice: 1800 }, select: { id: true } })).id;
    job = (await prisma.document.create({ data: { tenantId: tenant.id, type: "JOB_CARD", jobNumber: "JC-9301", jobStatus: "WORK_IN_PROGRESS", taxRate: "15.00" }, select: { id: true } })).id;
});

after(async () => {
    const tenantId = tenant.id;
    await prisma.stockMovement.deleteMany({ where: { tenantId } });
    await prisma.documentLine.deleteMany({ where: { tenantId } });
    await prisma.documentStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.requisitionIssue.deleteMany({ where: { tenantId } });
    await prisma.requisitionSignoff.deleteMany({ where: { tenantId } });
    await prisma.requisitionLine.deleteMany({ where: { tenantId } });
    await prisma.requisition.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.signingAuthority.deleteMany({ where: { tenantId } });
    await prisma.workshop.deleteMany({ where: { tenantId } });
    await prisma.orgUnit.deleteMany({ where: { tenantId, parentId: { not: null } } });
    await prisma.orgUnit.deleteMany({ where: { tenantId } });
    await prisma.sequence.deleteMany({ where: { tenantId } });
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("raised on the job card, the job waits for parts while the requisition is open, and it is approved", async () => {
    req = await run((tx) =>
        saveRequisition(tx, tenant, people.mechanic, null, {
            kind: "STORES", workshopId: workshop, chargeDocumentId: job, chargeVoteId: null,
            lines: [{ productId: product, description: "Brake pads, heavy duty, axle set", quantity: 3, unitCost: 1200 }],
        }),
    );
    assert.equal(await jobStatus(), "WORK_IN_PROGRESS", "a draft is not something the job waits on");
    await run((tx) => submitRequisition(tx, tenant, people.mechanic, req));
    assert.equal(await jobStatus(), "WAITING_FOR_PARTS");
    const event = await prisma.documentStatusEvent.findFirstOrThrow({ where: { documentId: job }, select: { fromStatus: true, toStatus: true, comment: true } });
    assert.deepEqual(event, { fromStatus: "WORK_IN_PROGRESS", toStatus: "WAITING_FOR_PARTS", comment: "A requisition for parts is open." });

    await assert.rejects(issue("storeman", 1, { membershipId: people.mechanic.membershipId }), /not been approved/);
    await run((tx) => decideRequisition(tx, tenant, people.foreman, req, "APPROVED"));
    await run((tx) => decideRequisition(tx, tenant, people.head, req, "APPROVED"));
    assert.equal((await prisma.requisition.findUniqueOrThrow({ where: { id: req }, select: { state: true } })).state, "APPROVED");
    assert.equal(await jobStatus(), "WAITING_FOR_PARTS", "approved is not yet in the mechanic's hand");
});

test("stores issues it in two handovers to a named receiver, once off the shelf and onto the job card at cost", async () => {
    await assert.rejects(issue("mechanic", 1, { membershipId: people.foreman.membershipId }), /Only stores/);
    await assert.rejects(issue("storeman", 1, { membershipId: people.storeman.membershipId }), /cannot also be the one receiving/);
    await assert.rejects(issue("storeman", 4, { membershipId: people.mechanic.membershipId }), /Only 3 of/);
    await assert.rejects(issue("storeman", 1, { name: " " }), /Name the person receiving/);
    await assert.rejects(issue("storeman", 1, { name: "Storeman ZZTEST", payNumber: "PN-00000" }), /cannot also be the one receiving/, "the storeman's own name typed in");
    await assert.rejects(issue("storeman", 1, { name: "Petrus Amukoto" }), /pay number/);

    assert.equal((await issue("storeman", 2, { membershipId: people.mechanic.membershipId })).state, "APPROVED");
    assert.equal(await onHand(), 8);
    // A receiver without a login, by name and pay number.
    assert.equal((await issue("storeman", 1, { name: "Petrus Amukoto", payNumber: "PN-77120" })).state, "AWAITING_FINALISE");
    assert.equal(await onHand(), 7);
    await assert.rejects(issue("storeman", 1, { name: "Petrus Amukoto" }), /Everything on it has been issued/);

    const handovers = await prisma.requisitionIssue.findMany({ where: { requisitionId: req }, orderBy: { at: "asc" }, select: { receiverName: true, receiverPayNumber: true, receiverMembershipId: true, issuedByName: true, issuedByPayNumber: true } });
    const verified = { issuedByName: "storeman ZZTEST", issuedByPayNumber: "PN-storeman" };
    assert.deepEqual(handovers, [
        { receiverName: "mechanic ZZTEST", receiverPayNumber: "PN-mechanic", receiverMembershipId: people.mechanic.membershipId, ...verified },
        { receiverName: "Petrus Amukoto", receiverPayNumber: "PN-77120", receiverMembershipId: null, ...verified },
    ], "the storeman's verification is kept as it stood, like every other box");
    const lines = await prisma.documentLine.findMany({ where: { documentId: job }, orderBy: { sortOrder: "asc" }, select: { quantity: true, unitPrice: true, requisitionLineId: true } });
    assert.deepEqual(lines.map((l) => [l.quantity.toNumber(), l.unitPrice.toNumber(), !!l.requisitionLineId]), [[2, 1200, true], [1, 1200, true]], "at cost, marked as issued");
    assert.equal(await jobStatus(), "WORK_IN_PROGRESS", "the parts are in hand, so the job is back in progress");
});

test("the job card's invoice does not take the issued parts off the shelf a second time", async () => {
    const invoice = (await prisma.document.create({ data: { tenantId: tenant.id, type: "INVOICE", taxRate: "15.00", postDate: new Date() }, select: { id: true, postDate: true } }));
    const issued = await prisma.documentLine.findMany({ where: { documentId: job }, select: { productId: true, quantity: true, unitPrice: true, unitCost: true, requisitionLineId: true, description: true } });
    for (const [sortOrder, l] of issued.entries()) await prisma.documentLine.create({ data: { tenantId: tenant.id, documentId: invoice.id, sortOrder, ...l } });
    await run((tx) => postDocumentStock(tx, tenant.id, { id: invoice.id, type: "INVOICE", postDate: invoice.postDate }, people.storeman.membershipId));
    assert.equal(await onHand(), 7, "still 7: the issue was the movement");
    assert.equal(await prisma.stockMovement.count({ where: { productId: product } }), 2, "two issues and nothing else");
});

test("stores cannot issue more than the shelf holds", async () => {
    await prisma.product.update({ where: { id: product }, data: { qtyOnHand: 1 } });
    const short = await run((tx) =>
        saveRequisition(tx, tenant, people.mechanic, null, {
            kind: "STORES", workshopId: workshop, chargeDocumentId: job, chargeVoteId: null,
            lines: [{ productId: product, description: "Brake pads, heavy duty, axle set", quantity: 2, unitCost: 1200 }],
        }),
    );
    await run((tx) => submitRequisition(tx, tenant, people.mechanic, short));
    await run((tx) => decideRequisition(tx, tenant, people.foreman, short, "APPROVED"));
    await run((tx) => decideRequisition(tx, tenant, people.head, short, "APPROVED"));
    const line = await prisma.requisitionLine.findFirstOrThrow({ where: { requisitionId: short }, select: { id: true } });
    const hand = (quantity: number) => run((tx) => issueStores(tx, tenant, { ...people.storeman, canIssue: true }, short, { lines: [{ lineId: line.id, quantity }], receiver: { membershipId: people.mechanic.membershipId } }));
    await assert.rejects(hand(2), /Only 1 of “Brake pads, heavy duty, axle set” is on the shelf/);
    assert.equal((await hand(1)).state, "APPROVED", "what is there goes; the rest can follow");
    assert.equal(await onHand(), 0);
    await prisma.product.update({ where: { id: product }, data: { qtyOnHand: 7 } });
});

test("it closes when the foreman, the fleet coordinator and the divisional head have signed", async () => {
    await run((tx) => finaliseRequisition(tx, tenant, people.foreman, req, "FINAL_FOREMAN"));
    await run((tx) => finaliseRequisition(tx, tenant, people.coordinator, req, "FINAL_FLEET_COORDINATOR"));
    const { state } = await run((tx) => finaliseRequisition(tx, tenant, people.head, req, "FINAL_DIVISIONAL_HEAD"));
    assert.equal(state, "CLOSED");
});
