import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { blockedModels } from "@/lib/plans/features";
import { planFor } from "@/lib/plans/tenant";

/**
 * The plan, where it is read and where it is enforced: the subscription it
 * comes from, and the database layer that refuses a feature's tables to a
 * workshop whose plan does not include it.
 */

const SLUG = "zztest-plans";
let tenantId = "";

before(async () => {
    const t = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Plans", country: "NA" }, select: { id: true } });
    tenantId = t.id;
});

after(async () => {
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.supplier.deleteMany({ where: { tenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: SLUG } });
});

test("a workshop with no subscription is on no plan — and so keeps everything", async () => {
    assert.equal(await planFor(forTenant(tenantId), tenantId), null);
});

test("the plan is the subscription's, and a cancelled subscription is no plan", async () => {
    await prisma.subscription.create({ data: { tenantId, planId: "workshop", planName: "Workshop", priceAmount: 1200, reference: "MOT-ZZPLNA", status: "ACTIVE" } });
    assert.equal(await planFor(forTenant(tenantId), tenantId), "workshop");
    await prisma.subscription.update({ where: { tenantId }, data: { status: "CANCELLED" } });
    assert.equal(await planFor(forTenant(tenantId), tenantId), null);
    await prisma.subscription.update({ where: { tenantId }, data: { status: "ACTIVE" } });
});

test("on Workshop, a feature's own tables refuse writes — reads and everyday tables do not", async () => {
    const refused: string[] = [];
    const db = forTenant(tenantId, {
        blocked: blockedModels("workshop"),
        refuseBlocked: (model) => {
            refused.push(model);
            throw new Error(`refused ${model}`);
        },
    });
    await assert.rejects(() => db.supplier.create({ data: { tenantId, companyName: "ZZTEST Supplier" } }), /refused Supplier/);
    await assert.rejects(() => db.$transaction((tx) => tx.supplier.create({ data: { tenantId, companyName: "ZZTEST Supplier" } })), /refused Supplier/, "a transaction is no way round it");
    assert.deepEqual(refused, ["Supplier", "Supplier"]);
    assert.deepEqual(await db.supplier.findMany({ where: { companyName: "ZZTEST Supplier" } }), [], "reads still work");
    const customer = await db.customer.create({ data: { tenantId, firstName: "ZZTEST", lastName: "Customer" }, select: { id: true } });
    assert.ok(customer.id, "an everyday table was refused");
});

test("on Full workshop, the same write goes through", async () => {
    const db = forTenant(tenantId, { blocked: blockedModels("full"), refuseBlocked: () => { throw new Error("refused"); } });
    const supplier = await db.supplier.create({ data: { tenantId, companyName: "ZZTEST Supplier" }, select: { id: true } });
    assert.ok(supplier.id);
});
