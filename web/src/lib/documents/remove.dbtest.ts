import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { forTenant, type TenantDb } from "@/lib/tenant-db";
import { deleteDocument, NotDeletable } from "@/lib/documents/remove";

/**
 * Deleting a stray duplicate, and refusing to delete anything else.
 *
 * This is the one destructive action in MOTION, so what it will not do matters
 * more than what it will. A document with money attached is part of the books;
 * a second job card created by a double tap is not.
 */

const ID = "zztest-remove";
let tenantId = "";
let db: TenantDb;
let customerId = "";

const doc = async (state: "DRAFT" | "VOID" | "PROCESSED", number: string) =>
    (await prisma.document.create({
        data: { tenantId, type: "JOB_CARD", state, number, customerId, total: 1500 },
        select: { id: true },
    })).id;

before(async () => {
    const t = await prisma.tenant.create({ data: { slug: ID, name: "ZZTEST Remove", country: "NA" }, select: { id: true } });
    tenantId = t.id;
    db = forTenant(tenantId);
    const c = await prisma.customer.create({ data: { tenantId, firstName: "ZZTEST", lastName: "Owner" }, select: { id: true } });
    customerId = c.id;
});

after(async () => {
    if (!tenantId) return;
    await prisma.paymentAllocation.deleteMany({ where: { tenantId } });
    await prisma.paymentTender.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.documentLine.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
});

test("a voided duplicate goes, and what it said comes back in the snapshot", async () => {
    const id = await doc("VOID", "JC-7001");
    await prisma.documentLine.create({
        data: { tenantId, documentId: id, description: "Major service", quantity: 1, unitPrice: 1500, lineTotal: 1500, sortOrder: 0 },
    });

    const { snapshot, number } = await db.$transaction((tx) => deleteDocument(tx, id, "duplicate of JC-7000"));

    assert.equal(number, "JC-7001");
    const kept = snapshot as { lines: { description: string }[]; total: unknown; deletedBecause: string };
    assert.equal(kept.lines[0].description, "Major service", "the lines were not captured before deletion");
    assert.equal(kept.deletedBecause, "duplicate of JC-7000");
    assert.equal(await prisma.document.count({ where: { id } }), 0, "the document is still there");
});

test("a processed document is refused — void it first", async () => {
    const id = await doc("PROCESSED", "JC-7002");
    await assert.rejects(
        db.$transaction((tx) => deleteDocument(tx, id, "tidying up")),
        (e: Error) => e instanceof NotDeletable && /void this one first/i.test(e.message),
    );
    assert.equal(await prisma.document.count({ where: { id } }), 1, "a processed document was deleted");
});

test("a voided document with a payment against it is refused, and says so", async () => {
    // The dangerous case: voided, so it passes the state check, but money has
    // moved against it and deleting would orphan the allocation.
    const id = await doc("VOID", "JC-7003");
    const payment = await prisma.payment.create({
        data: { tenantId, customerId, amount: 500, state: "PROCESSED", direction: "RECEIPT" },
        select: { id: true },
    });
    await prisma.paymentAllocation.create({ data: { tenantId, paymentId: payment.id, documentId: id, amount: 500 } });

    await assert.rejects(
        db.$transaction((tx) => deleteDocument(tx, id, "looks like a duplicate")),
        (e: Error) => e instanceof NotDeletable && /payment against it/i.test(e.message),
    );
    assert.equal(await prisma.document.count({ where: { id } }), 1, "a document with money against it was deleted");
});

test("a draft with nothing attached goes cleanly", async () => {
    const id = await doc("DRAFT", "JC-7004");
    await db.$transaction((tx) => deleteDocument(tx, id, "created by a double tap"));
    assert.equal(await prisma.document.count({ where: { id } }), 0);
});
