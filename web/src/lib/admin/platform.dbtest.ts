import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appRoleUrl, prepareAppRole } from "@/lib/testing/app-role";

/**
 * The staff exemption, tested where it is enforced.
 *
 * `motion.platform_admin` lifts row-level security for MOTION's own team so
 * they can see every workshop's registration and approve it. The danger of an
 * exemption is that it is wider than it says, so the test that matters here is
 * not that staff can see subscriptions — it is that, with the flag set, a
 * workshop's customers and documents **still return nothing**. That is what
 * would catch a future policy copied onto the wrong table.
 *
 * Everything that checks a policy connects as `motion_app`, which is
 * NOBYPASSRLS. The dev and CI connection is a superuser, and a superuser
 * ignores row-level security unconditionally — a test written against it would
 * pass while proving nothing.
 */

const ID = "zztest-platform";

let alpha = "";
let bravo = "";
let actor = "";
let appDb: PrismaClient;


/** One transaction with whatever settings the case needs, local to it. */
async function inTx<T>(settings: Record<string, string>, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return appDb.$transaction(async (tx) => {
        for (const [key, value] of Object.entries(settings)) {
            await tx.$executeRawUnsafe(`SELECT set_config($1, $2, true)`, key, value);
        }
        return fn(tx as unknown as PrismaClient);
    });
}

const STAFF = { "motion.platform_admin": "on" };

before(async () => {
    await prepareAppRole(prisma);

    const a = await prisma.tenant.create({ data: { status: "PENDING_PAYMENT", slug: `${ID}-a`, name: "ZZTEST Platform Alpha", country: "NA" }, select: { id: true } });
    const b = await prisma.tenant.create({ data: { status: "ACTIVE", slug: `${ID}-b`, name: "ZZTEST Platform Bravo", country: "NA" }, select: { id: true } });
    alpha = a.id;
    bravo = b.id;

    await prisma.subscription.create({ data: { tenantId: alpha, planId: "workshop", planName: "Workshop", priceAmount: 1200, reference: "MOT-ZZPLTA" } });
    await prisma.subscription.create({ data: { tenantId: bravo, planId: "full", planName: "Full workshop", priceAmount: 2400, reference: "MOT-ZZPLTB" } });

    // Real workshop data in both, so "staff see none of it" is a statement
    // about rows that exist rather than about an empty table.
    await prisma.customer.create({ data: { tenantId: alpha, firstName: "ZZTEST", lastName: "PlatformAlpha" } });
    await prisma.customer.create({ data: { tenantId: bravo, firstName: "ZZTEST", lastName: "PlatformBravo" } });

    const u = await prisma.user.create({
        data: { email: `${ID}@example.invalid`, passwordHash: "x", firstName: "ZZTEST", lastName: "Staff", isPlatformStaff: true },
        select: { id: true },
    });
    actor = u.id;

    appDb = new PrismaClient({ datasourceUrl: appRoleUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    // The superuser connection ignores RLS, which is what cleaning up needs.
    await prisma.platformAuditEvent.deleteMany({ where: { actorUserId: actor } });
    await prisma.customer.deleteMany({ where: { lastName: { startsWith: "Platform" }, firstName: "ZZTEST" } });
    await prisma.subscription.deleteMany({ where: { reference: { startsWith: "MOT-ZZPLT" } } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: ID } } });
    await prisma.user.deleteMany({ where: { email: `${ID}@example.invalid` } });
});

// ── the billing tables open to staff ─────────────────────────────────────────

test("a session that has declared nothing sees no subscriptions", async () => {
    const rows = await inTx({}, (tx) => tx.subscription.findMany({ where: { reference: { startsWith: "MOT-ZZPLT" } } }));
    assert.equal(rows.length, 0);
});

test("a workshop still sees only its own subscription", async () => {
    const rows = await inTx({ "motion.tenant_id": alpha }, (tx) => tx.subscription.findMany({ where: { reference: { startsWith: "MOT-ZZPLT" } } }));
    assert.deepEqual(rows.map((r) => r.reference), ["MOT-ZZPLTA"]);
});

test("a staff session sees every workshop's subscription", async () => {
    const rows = await inTx(STAFF, (tx) =>
        tx.subscription.findMany({ where: { reference: { startsWith: "MOT-ZZPLT" } }, orderBy: { reference: "asc" } }),
    );
    assert.deepEqual(rows.map((r) => r.reference), ["MOT-ZZPLTA", "MOT-ZZPLTB"]);
});

test("a staff session can mark a subscription paid", async () => {
    const updated = await inTx(STAFF, (tx) =>
        tx.subscription.updateMany({ where: { reference: "MOT-ZZPLTA" }, data: { status: "ACTIVE" } }),
    );
    assert.equal(updated.count, 1);
});

// ── and nothing else ─────────────────────────────────────────────────────────

test("a staff session sees none of a workshop's customers", async () => {
    // The test that matters. Approving a deposit needs what a workshop agreed
    // to pay; it needs nothing from its books. If this ever returns rows, the
    // exemption has spread beyond billing and every workshop's customers are
    // readable by MOTION's staff.
    const rows = await inTx(STAFF, (tx) => tx.customer.findMany({ where: { lastName: { startsWith: "Platform" } } }));
    assert.equal(rows.length, 0, "the staff flag exposed a workshop's customers");
});

test("a staff session sees none of a workshop's documents or payments", async () => {
    const [documents, payments] = await inTx(STAFF, async (tx) => [await tx.document.count(), await tx.payment.count()]);
    assert.equal(documents, 0, "the staff flag exposed documents");
    assert.equal(payments, 0, "the staff flag exposed payments");
});

test("the staff flag does not outlive its transaction", async () => {
    await inTx(STAFF, (tx) => tx.subscription.count());
    // A fresh transaction on the same pool, with nothing declared. If the flag
    // leaked it would see both subscriptions; it must see neither.
    const rows = await inTx({}, (tx) => tx.subscription.findMany({ where: { reference: { startsWith: "MOT-ZZPLT" } } }));
    assert.equal(rows.length, 0, "motion.platform_admin survived into another transaction");
});

// ── MOTION's own record ──────────────────────────────────────────────────────

test("only a staff session can write the platform audit trail", async () => {
    await assert.rejects(
        () => inTx({ "motion.tenant_id": alpha }, (tx) => tx.platformAuditEvent.create({ data: { actorUserId: actor, action: "ACTIVATED", tenantId: alpha } })),
        /row-level security|violates/i,
        "a workshop session wrote to MOTION's audit trail",
    );
    const made = await inTx(STAFF, (tx) => tx.platformAuditEvent.create({ data: { actorUserId: actor, action: "ACTIVATED", tenantId: alpha } }));
    assert.ok(made.id);
});

test("a workshop cannot read MOTION's record of what was done to it", async () => {
    const asWorkshop = await inTx({ "motion.tenant_id": alpha }, (tx) => tx.platformAuditEvent.findMany({ where: { actorUserId: actor } }));
    assert.equal(asWorkshop.length, 0);
    const asStaff = await inTx(STAFF, (tx) => tx.platformAuditEvent.findMany({ where: { actorUserId: actor } }));
    assert.ok(asStaff.length >= 1);
});
