import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { workInProgress } from "@/lib/documents/wip";
import { stockValuation } from "@/lib/stock/valuation";

/**
 * The two owner reports whose answer depends on what they leave out.
 *
 * Phase one taught this the expensive way: a report that filtered documents by
 * state reported twenty missing job cards at a workshop that had lost none,
 * because every booking in the diary is a draft. An exclusion rule that is
 * slightly wrong does not produce a slightly wrong report — it produces a
 * confident one that is missing things, which is worse than no report.
 *
 * So both of these are tested by building each kind of thing they must decide
 * about and checking which ones came out.
 *
 * Against a real Postgres (`npm run test:db`).
 */

const SLUG = "zztest-business";
let tenantId = "";
const ASAT = new Date("2026-04-15T12:00:00Z");

before(async () => {
    const t = await prisma.tenant.create({ data: { slug: SLUG, name: "ZZTEST Business Motors", country: "NA" }, select: { id: true } });
    tenantId = t.id;
});

after(async () => {
    await prisma.documentLine.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
});

test("work in progress is the open job cards, and nothing else that happens to be a draft", async () => {
    const db = forTenant(tenantId);
    const doc = (type: "JOB_CARD" | "BOOKING" | "QUOTE" | "INVOICE", state: "DRAFT" | "PROCESSED", extra: Record<string, unknown> = {}) =>
        prisma.document.create({
            data: {
                tenantId, type, state, postDate: new Date("2026-04-01T00:00:00Z"),
                taxName: "VAT", taxRate: 15, total: 500, ...extra,
            },
        });

    await doc("JOB_CARD", "DRAFT", { jobNumber: "JC-1", jobStatus: "WORK_IN_PROGRESS" });
    await doc("JOB_CARD", "DRAFT", { jobNumber: "JC-2", jobStatus: "WAITING_FOR_PARTS" });
    // Invoiced: it has left work in progress and is in the sales register now.
    await doc("JOB_CARD", "PROCESSED", { jobNumber: "JC-3", number: "JC-3" });
    // A booking in the diary is a draft too, and is not work standing in the
    // workshop. This is the phase-one trap, in the other direction.
    await doc("BOOKING", "DRAFT", {});
    await doc("QUOTE", "DRAFT", {});
    await doc("INVOICE", "DRAFT", {});

    const wip = await workInProgress(db, ASAT);
    assert.deepEqual(wip.rows.map((r) => r.number).sort(), ["JC-1", "JC-2"]);
    assert.equal(wip.total, 1000);
    assert.equal(wip.rows.length, 2);
});

test("a job opened after the date asked for is not yet work in progress", async () => {
    const db = forTenant(tenantId);
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.document.create({
        data: {
            tenantId, type: "JOB_CARD", state: "DRAFT", jobNumber: "JC-LATE",
            postDate: new Date("2026-05-01T00:00:00Z"), taxName: "VAT", taxRate: 15, total: 900,
        },
    });
    const wip = await workInProgress(db, ASAT);
    assert.equal(wip.rows.length, 0, "a job opened in May is not open work in the middle of April");
});

test("age is counted from the day the car arrived, which is the post date", async () => {
    const db = forTenant(tenantId);
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.document.create({
        data: {
            tenantId, type: "JOB_CARD", state: "DRAFT", jobNumber: "JC-OLD",
            postDate: new Date("2026-04-01T00:00:00Z"), taxName: "VAT", taxRate: 15, total: 100,
        },
    });
    const wip = await workInProgress(db, ASAT);
    assert.equal(wip.rows[0].age, 14);
    assert.equal(wip.oldest, 14);
});

test("a stock valuation counts what sits on a shelf, at cost, and leaves out what cannot", async () => {
    const db = forTenant(tenantId);
    const product = (itemCode: string, extra: Record<string, unknown>) =>
        prisma.product.create({ data: { tenantId, itemCode, description: itemCode, ...extra } });

    await product("PART", { qtyOnHand: 4, costExTax: 25, retailPrice: 40 });
    await product("LABOUR-HOUR", { type: "LABOUR", qtyOnHand: 99, costExTax: 10 });
    await product("A-SERVICE", { isService: true, qtyOnHand: 99, costExTax: 10 });
    await product("BULK-OIL", { dontUpdateQty: true, qtyOnHand: 99, costExTax: 10 });
    await product("GONE", { archivedAt: new Date(), qtyOnHand: 5, costExTax: 10 });
    // Nothing on the shelf is not a line in a valuation.
    await product("EMPTY", { qtyOnHand: 0, costExTax: 10 });
    // A negative is a counting error, and stays so it can be found.
    await product("OVERSOLD", { qtyOnHand: -2, costExTax: 30 });
    // On the shelf with no cost: valued at nil, and said so.
    await product("NOCOST", { qtyOnHand: 3, costExTax: 0, retailPrice: 50 });

    const v = await stockValuation(db);
    assert.deepEqual(v.rows.map((r) => r.itemCode).sort(), ["NOCOST", "OVERSOLD", "PART"]);
    assert.equal(v.value, 100 - 60, "4 at 25 less the 2 oversold at 30");
    assert.equal(v.retail, 160 + 150, "retail follows the same lines");
    assert.equal(v.negative, 1);
    assert.equal(v.noCost, 1);
});
