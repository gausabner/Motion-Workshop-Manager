import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";

/**
 * The wall between two clients.
 *
 * Our clients are separate legal entities — separate tax numbers, separate
 * bank accounts, separate books — and none of them may see another. That
 * promise rests entirely on this extension until row-level security exists in
 * the database, so it is worth a test that tries to break it rather than a
 * comment saying it holds.
 *
 * Runs against a real Postgres (`npm run test:db`), because the thing under
 * test is the query that actually reaches the database.
 */

const ID = "zztest-isolation";
let alpha = "";
let bravo = "";
let bravoCustomerId = "";

before(async () => {
    const a = await prisma.tenant.create({ data: { slug: `${ID}-a`, name: "ZZTEST Alpha Motors", country: "NA" }, select: { id: true } });
    const b = await prisma.tenant.create({ data: { slug: `${ID}-b`, name: "ZZTEST Bravo Motors", country: "NA" }, select: { id: true } });
    alpha = a.id;
    bravo = b.id;
    const customer = await prisma.customer.create({ data: { tenantId: bravo, firstName: "ZZTEST", lastName: "BravoOnly" }, select: { id: true } });
    bravoCustomerId = customer.id;
});

after(async () => {
    for (const id of [alpha, bravo]) {
        if (!id) continue;
        await prisma.documentLine.deleteMany({ where: { tenantId: id } });
        await prisma.document.deleteMany({ where: { tenantId: id } });
        await prisma.customer.deleteMany({ where: { tenantId: id } });
        await prisma.tenant.delete({ where: { id } });
    }
    await prisma.$disconnect();
});

test("one client cannot read another's records, by any route", async () => {
    const db = forTenant(alpha);
    assert.equal(await db.customer.findUnique({ where: { id: bravoCustomerId } }), null, "by id");
    assert.equal(await db.customer.findFirst({ where: { id: bravoCustomerId } }), null, "findFirst");
    assert.deepEqual(await db.customer.findMany({ where: { lastName: "BravoOnly" } }), [], "by a field");
    assert.equal(await db.customer.count({ where: { lastName: "BravoOnly" } }), 0, "count");
    assert.deepEqual(await db.document.findMany({ where: { customer: { id: bravoCustomerId } } }), [], "through a relation");

    const grouped = await db.customer.groupBy({ by: ["lastName"], where: { lastName: "BravoOnly" }, _count: true });
    assert.deepEqual(grouped, [], "groupBy");
    const aggregated = await db.customer.aggregate({ where: { lastName: "BravoOnly" }, _count: true });
    assert.equal(aggregated._count, 0, "aggregate");
});

test("one client cannot change or destroy another's records", async () => {
    const db = forTenant(alpha);
    assert.equal((await db.customer.updateMany({ where: { id: bravoCustomerId }, data: { firstName: "TAKEN" } })).count, 0, "updateMany");
    assert.equal((await db.customer.deleteMany({ where: { id: bravoCustomerId } })).count, 0, "deleteMany");

    await assert.rejects(() => db.customer.update({ where: { id: bravoCustomerId }, data: { firstName: "TAKEN" } }), "update by id");
    await assert.rejects(() => db.customer.delete({ where: { id: bravoCustomerId } }), "delete by id");

    const survivor = await prisma.customer.findUniqueOrThrow({ where: { id: bravoCustomerId }, select: { firstName: true } });
    assert.equal(survivor.firstName, "ZZTEST", "the record is untouched");
});

test("a write that names another client's tenant lands in the caller's own", async () => {
    const db = forTenant(alpha);
    const created = await db.customer.create({ data: { tenantId: bravo, firstName: "ZZTEST", lastName: "Claimed" }, select: { id: true, tenantId: true } });
    assert.equal(created.tenantId, alpha, "the claim is overwritten");
    await prisma.customer.delete({ where: { id: created.id } });
});

test("a write that reaches for another client through a relation cannot plant a record there", async () => {
    const db = forTenant(alpha);
    // `connect` is the documented way to set a foreign key, so a handler could
    // reasonably reach for it. If the extension steps aside when it sees one,
    // this is a hole big enough to put a whole customer through.
    await assert.rejects(
        () => db.customer.create({ data: { tenant: { connect: { id: bravo } }, firstName: "ZZTEST", lastName: "Connected" } }),
        /tenantId/,
        "connect must be refused, not quietly honoured",
    );
    assert.equal(await prisma.customer.count({ where: { lastName: "Connected" } }), 0, "nothing was written anywhere");
});

test("upsert cannot reach another client's record, nor create one there", async () => {
    const db = forTenant(alpha);
    const result = await db.customer.upsert({
        where: { id: bravoCustomerId },
        update: { firstName: "TAKEN" },
        create: { tenantId: bravo, firstName: "ZZTEST", lastName: "Upserted" },
        select: { id: true, tenantId: true },
    });
    await prisma.customer.deleteMany({ where: { id: result.id, tenantId: { not: bravo } } });
    assert.notEqual(result.id, bravoCustomerId, "it must not have matched the other client's row");
    assert.equal(result.tenantId, alpha, "the new row belongs to the caller");
    assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: bravoCustomerId }, select: { firstName: true } })).firstName, "ZZTEST");
});

test("every write operation Prisma offers is scoped, including the ones added after this was written", async () => {
    const db = forTenant(alpha) as unknown as Record<string, Record<string, (args: unknown) => Promise<unknown>>>;
    // updateManyAndReturn arrived in a later Prisma than the extension's switch
    // statement. If a new bulk operation is not handled, it writes unscoped.
    if (typeof db.customer.updateManyAndReturn === "function") {
        const returned = (await db.customer.updateManyAndReturn({
            where: { id: bravoCustomerId },
            data: { firstName: "TAKEN" },
            select: { id: true },
        })) as { id: string }[];
        assert.deepEqual(returned, [], "updateManyAndReturn must not touch another client's row");
        assert.equal((await prisma.customer.findUniqueOrThrow({ where: { id: bravoCustomerId }, select: { firstName: true } })).firstName, "ZZTEST");
    }
});
