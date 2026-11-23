import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Designation, Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { addQuote, chooseQuote, decideRequisition, finaliseRequisition, saveRequisition, submitRequisition, type Actor } from "@/lib/requisitions/service";
import { issueStores } from "@/lib/requisitions/stores";
import { orderFromRequisition, requestQuotes, splitToPurchase } from "@/lib/requisitions/purchase";
import { processInvoice, receiptFromOrder } from "@/lib/purchasing/service";
import { resolveShareToken } from "@/lib/sharing/links";

/**
 * Buying what stores cannot issue, against a real database: stores issues the
 * one gasket on the shelf and splits the rest, and the bearing it does not
 * keep, into a numbered purchase requisition; the job keeps waiting for
 * parts; a parts driver brings back two quotations, asks a supplier by link,
 * and sends it for approval; stores orders it at the chosen price; the
 * supplier invoice brings it in; stores hands both over, the bearing straight
 * from the delivery; and both requisitions are finalised.
 */

const SLUG = "zztest-purchase";
const PEOPLE = ["mechanic", "foreman", "head", "storeman", "coordinator", "driver"] as const;
type Who = (typeof PEOPLE)[number];
const DESIGNATIONS: Record<Who, Designation[]> = { mechanic: ["MECHANIC"], foreman: ["FOREMAN"], head: ["DIVISION_HEAD"], storeman: ["STOREMAN"], coordinator: ["FLEET_COORDINATOR"], driver: ["PARTS_DRIVER"] };

let tenant: Tenant;
let job = "";
let gasket = "";
let stores = "";
let purchase = "";
let workshop = "";
const suppliers: string[] = [];
const people = {} as Record<Who, Actor>;

const db = () => forTenant(tenant.id);
const run = <T,>(fn: (tx: Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0]) => Promise<T>) => db().$transaction(fn) as Promise<T>;
const as = (who: Who): Actor => ({ ...people[who], canIssue: who === "storeman" });
const state = async (id: string) => (await prisma.requisition.findUniqueOrThrow({ where: { id }, select: { state: true } })).state;
const jobStatus = async () => (await prisma.document.findUniqueOrThrow({ where: { id: job }, select: { jobStatus: true } })).jobStatus;
const onHand = async () => (await prisma.product.findUniqueOrThrow({ where: { id: gasket }, select: { qtyOnHand: true } })).qtyOnHand.toNumber();
const linesOf = (id: string) => prisma.requisitionLine.findMany({ where: { requisitionId: id }, orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, sourceLineId: true } });

before(async () => {
    tenant = await prisma.tenant.create({
        data: {
            status: "ACTIVE", slug: SLUG, name: "ZZTEST Purchase Council", country: "NA", salesTaxRate: "15.00", purchaseTaxRate: "15.00",
            settings: { requisitions: { quoteBands: [{ from: 0, quotes: 1 }, { from: 2000, quotes: 2 }] } },
        },
    });
    for (const p of PEOPLE) {
        const user = await prisma.user.create({ data: { email: `${SLUG}-${p}@example.invalid`, passwordHash: "x", firstName: p, lastName: "ZZTEST" }, select: { id: true } });
        const m = await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, group: "FOREMAN", status: "ACTIVE", designations: DESIGNATIONS[p], payNumber: `PN-${p}` }, select: { id: true } });
        people[p] = { membershipId: m.id, userId: user.id };
    }
    const division = (await prisma.orgUnit.create({ data: { tenantId: tenant.id, name: "Technical Services" }, select: { id: true } })).id;
    workshop = (await prisma.workshop.create({ data: { tenantId: tenant.id, name: "Heavy duty vehicles", kind: "WORKSHOP", orgUnitId: division }, select: { id: true } })).id;
    await prisma.signingAuthority.createMany({
        data: [
            { tenantId: tenant.id, kind: "FOREMAN", membershipId: people.foreman.membershipId, workshopId: workshop },
            { tenantId: tenant.id, kind: "DIVISION_HEAD", membershipId: people.head.membershipId, orgUnitId: division },
            { tenantId: tenant.id, kind: "FLEET_COORDINATOR", membershipId: people.coordinator.membershipId, orgUnitId: division },
        ],
    });
    gasket = (await prisma.product.create({ data: { tenantId: tenant.id, itemCode: "FL-ATG-PG", description: "Pump gearbox gasket set", type: "STOCK", qtyOnHand: 1, costExTax: 760, retailPrice: 1100 }, select: { id: true } })).id;
    for (const [companyName, email] of [["Windhoek Bearings", "sales@bearings.example.invalid"], ["Khomas Hydraulics", null]] as const) {
        suppliers.push((await prisma.supplier.create({ data: { tenantId: tenant.id, companyName, email }, select: { id: true } })).id);
    }
    job = (await prisma.document.create({ data: { tenantId: tenant.id, type: "JOB_CARD", jobNumber: "JC-9401", jobStatus: "WORK_IN_PROGRESS", taxRate: "15.00" }, select: { id: true } })).id;
});

after(async () => {
    const tenantId = tenant.id;
    await prisma.supplierInvoiceLine.deleteMany({ where: { tenantId } });
    await prisma.stockMovement.deleteMany({ where: { tenantId } });
    await prisma.supplierInvoice.deleteMany({ where: { tenantId } });
    await prisma.purchaseOrderLine.deleteMany({ where: { tenantId } });
    await prisma.purchaseOrder.deleteMany({ where: { tenantId } });
    await prisma.documentLine.deleteMany({ where: { tenantId } });
    await prisma.documentStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.requisitionIssueLine.deleteMany({ where: { tenantId } });
    await prisma.requisitionIssue.deleteMany({ where: { tenantId } });
    await prisma.requisitionSignoff.deleteMany({ where: { tenantId } });
    await prisma.requisitionQuote.deleteMany({ where: { tenantId } });
    await prisma.requisitionLine.updateMany({ where: { tenantId }, data: { sourceLineId: null } });
    await prisma.requisitionLine.deleteMany({ where: { tenantId } });
    await prisma.requisition.updateMany({ where: { tenantId }, data: { sourceRequisitionId: null } });
    await prisma.requisition.deleteMany({ where: { tenantId } });
    await prisma.shareLink.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId } });
    await prisma.signingAuthority.deleteMany({ where: { tenantId } });
    await prisma.workshop.deleteMany({ where: { tenantId } });
    await prisma.orgUnit.deleteMany({ where: { tenantId } });
    await prisma.sequence.deleteMany({ where: { tenantId } });
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("stores issues what is on the shelf and splits the rest into a numbered purchase requisition", async () => {
    stores = await run((tx) =>
        saveRequisition(tx, tenant, people.mechanic, null, {
            kind: "STORES", workshopId: workshop, chargeDocumentId: job, chargeVoteId: null, purpose: "Pump gearbox noise",
            lines: [
                { productId: gasket, description: "Pump gearbox gasket set", quantity: 3, unitCost: 760 },
                { productId: null, description: "Output bearing, SKF 6310", quantity: 2, unitCost: 1280 },
            ],
        }),
    );
    await run((tx) => submitRequisition(tx, tenant, people.mechanic, stores));
    await run((tx) => decideRequisition(tx, tenant, people.foreman, stores, "APPROVED"));
    await run((tx) => decideRequisition(tx, tenant, people.head, stores, "APPROVED"));
    const [gasketLine] = await linesOf(stores);
    await run((tx) => issueStores(tx, tenant, as("storeman"), stores, { lines: [{ lineId: gasketLine.id, quantity: 1 }], receiver: { membershipId: people.mechanic.membershipId } }));
    assert.equal(await onHand(), 0);

    await assert.rejects(run((tx) => splitToPurchase(tx, tenant, as("mechanic"), stores)), /Only stores splits/);
    const made = await run((tx) => splitToPurchase(tx, tenant, as("storeman"), stores));
    purchase = made.id;
    assert.match(made.number, /^REQ-/, "numbered now, like the red serial on the form");
    const bought = await linesOf(purchase);
    assert.deepEqual(bought.map((l) => [l.description, l.quantity.toNumber(), !!l.sourceLineId]), [["Pump gearbox gasket set", 2, true], ["Output bearing, SKF 6310", 2, true]], "the shelf's shortfall and the item stores does not keep");
    const p = await prisma.requisition.findUniqueOrThrow({ where: { id: purchase }, select: { kind: true, state: true, requestedById: true, chargeDocumentId: true, sourceRequisitionId: true } });
    assert.deepEqual(p, { kind: "PURCHASE", state: "DRAFT", requestedById: people.mechanic.membershipId, chargeDocumentId: job, sourceRequisitionId: stores });
    assert.equal(await state(stores), "AWAITING_FINALISE", "nothing of it is left for stores: it goes to be finalised for the gasket it issued");
    assert.equal(await jobStatus(), "WAITING_FOR_PARTS", "the job waits for the purchase as it waited for the stores requisition");
    await assert.rejects(run((tx) => splitToPurchase(tx, tenant, as("storeman"), stores)), /approved/);
});

test("a parts driver brings back the quotations, asks by link, and sends it for approval", async () => {
    await assert.rejects(run((tx) => submitRequisition(tx, tenant, people.driver, purchase)), /Attach the quotation/);
    const cheap = await run((tx) => addQuote(tx, tenant, people.driver, purchase, { supplierId: suppliers[0], amount: 3000, reference: "Q-4471", validUntil: "2099-01-31" }));
    assert.equal((await prisma.requisitionQuote.findUniqueOrThrow({ where: { id: cheap }, select: { chosen: true } })).chosen, true, "the first one in is put forward");
    await assert.rejects(run((tx) => submitRequisition(tx, tenant, people.driver, purchase)), /needs 2 quotations\. It has 1/, "the council's rule, read at the chosen price");
    const dear = await run((tx) => addQuote(tx, tenant, people.driver, purchase, { supplierId: suppliers[1], amount: 3400 }));
    await run((tx) => chooseQuote(tx, tenant, people.driver, dear));
    await run((tx) => chooseQuote(tx, tenant, people.driver, cheap));
    assert.deepEqual((await prisma.requisitionQuote.findMany({ where: { requisitionId: purchase }, orderBy: { amount: "asc" }, select: { chosen: true } })).map((q) => q.chosen), [true, false], "one chosen at a time");

    await assert.rejects(run((tx) => requestQuotes(tx, tenant, people.driver, purchase, [suppliers[1]])), /has no email address/);
    const [asked] = await run((tx) => requestQuotes(tx, tenant, people.driver, purchase, [suppliers[0]]));
    const link = await resolveShareToken(asked.token);
    assert.ok(link.ok && link.kind === "QUOTATION_REQUEST" && link.targetId === purchase && link.params.supplierId === suppliers[0]);

    await assert.rejects(run((tx) => addQuote(tx, tenant, people.foreman, purchase, { supplierId: suppliers[1], amount: 1 })), /parts driver or stores/);
    const sent = await run((tx) => submitRequisition(tx, tenant, people.driver, purchase));
    assert.equal(sent.state, "AWAITING_FOREMAN");
    assert.equal((await prisma.requisition.findUniqueOrThrow({ where: { id: purchase }, select: { value: true } })).value.toNumber(), 3000, "approved at the chosen quotation");
    await run((tx) => decideRequisition(tx, tenant, people.foreman, purchase, "APPROVED"));
    await run((tx) => decideRequisition(tx, tenant, people.head, purchase, "APPROVED"));
    assert.equal(await state(purchase), "APPROVED");
});

test("stores orders it from the chosen supplier at their price, and the supplier invoice brings it in", async () => {
    await assert.rejects(run((tx) => orderFromRequisition(tx, tenant, as("driver"), purchase)), /Only stores raises/);
    const order = await run((tx) => orderFromRequisition(tx, tenant, as("storeman"), purchase));
    await assert.rejects(run((tx) => orderFromRequisition(tx, tenant, as("storeman"), purchase)), /already been ordered/);
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: order.id }, select: { supplierId: true, reference: true, state: true, lines: { orderBy: { sortOrder: "asc" }, select: { quantity: true, unitCost: true, documentId: true, requisitionLineId: true } } } });
    assert.equal(po.supplierId, suppliers[0]);
    assert.equal(po.reference, "Q-4471");
    const total = po.lines.reduce((sum, l) => sum + l.quantity.toNumber() * l.unitCost.toNumber(), 0);
    assert.ok(Math.abs(total - 3000) < 0.05, `priced at the quotation: ${total}`);
    assert.ok(po.lines.every((l) => l.documentId === job && l.requisitionLineId), "each line traces to its requisition line and its job");

    // Nothing is handed over before it arrives.
    const [gasketLine, bearingLine] = await linesOf(purchase);
    await assert.rejects(run((tx) => issueStores(tx, tenant, as("storeman"), purchase, { lines: [{ lineId: bearingLine.id, quantity: 1 }], receiver: { membershipId: people.mechanic.membershipId } })), /not arrived/);

    const invoice = await run((tx) => receiptFromOrder(tx, tenant, people.storeman.membershipId, order.id, new Date()));
    await prisma.supplierInvoice.update({ where: { id: invoice }, data: { supplierNumber: "INV-88102" } });
    await run((tx) => processInvoice(tx, tenant, people.storeman, invoice));
    assert.equal(await onHand(), 2, "the gaskets went onto the shelf, as every receipt does");
    void gasketLine;
});

test("stores hands both over, the bearing straight from the delivery, and both requisitions are finalised", async () => {
    const [gasketLine, bearingLine] = await linesOf(purchase);
    const done = await run((tx) => issueStores(tx, tenant, as("storeman"), purchase, { lines: [{ lineId: gasketLine.id, quantity: 2 }, { lineId: bearingLine.id, quantity: 2 }], receiver: { membershipId: null, name: "Petrus Amukoto", payNumber: "PN-77120" } }));
    assert.equal(done.state, "AWAITING_FINALISE");
    assert.equal(await onHand(), 0, "the gaskets came off the shelf again");
    const handed = await prisma.requisitionIssueLine.findMany({ where: { requisitionLine: { requisitionId: purchase } }, orderBy: { quantity: "asc" }, select: { quantity: true, unitCost: true, stockMovementId: true, requisitionLineId: true } });
    const bearing = handed.find((h) => h.requisitionLineId === bearingLine.id)!;
    assert.equal(bearing.stockMovementId, null, "an item bought for the job has no shelf to come off");
    const jobLines = await prisma.documentLine.findMany({ where: { documentId: job }, orderBy: { sortOrder: "asc" }, select: { description: true, quantity: true, unitPrice: true, requisitionLineId: true } });
    assert.deepEqual(jobLines.map((l) => [l.description, l.quantity.toNumber()]), [["Pump gearbox gasket set", 1], ["Pump gearbox gasket set", 2], ["Output bearing, SKF 6310", 2]]);
    assert.equal(jobLines[2].unitPrice.toNumber(), bearing.unitCost.toNumber(), "at what the supplier charged");
    assert.equal(await jobStatus(), "WORK_IN_PROGRESS", "the parts are in hand");

    for (const id of [stores, purchase]) {
        await run((tx) => finaliseRequisition(tx, tenant, people.foreman, id, "FINAL_FOREMAN"));
        await run((tx) => finaliseRequisition(tx, tenant, people.coordinator, id, "FINAL_FLEET_COORDINATOR"));
        await run((tx) => finaliseRequisition(tx, tenant, people.head, id, "FINAL_DIVISIONAL_HEAD"));
        assert.equal(await state(id), "CLOSED");
    }
});
