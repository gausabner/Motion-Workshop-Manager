import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * The registration gate, tested where it is actually enforced.
 *
 * Two guarantees live in the database rather than in TypeScript, and both fail
 * silently if they fail at all.
 *
 * **`isActive` is derived from `status` by a trigger.** Eight places decide
 * whether a workshop is allowed in by reading that boolean. If a script, a
 * migration or a future feature sets it directly, the boolean and the status
 * disagree — and the symptom is either a paying customer locked out or an
 * unpaid one let in, neither of which raises an error anywhere.
 *
 * **A subscription is a workshop's own row.** `Subscription` is FORCE RLS like
 * everything else carrying a `tenantId`, so one workshop must not read what
 * another agreed to pay. There is no cross-tenant reader yet; the admin panel
 * in Phase 2 will need an exemption, and this is what makes writing that
 * exemption a deliberate act rather than a side effect.
 *
 * Everything checking a policy connects as `motion_app`, which is NOBYPASSRLS.
 * The dev and CI connection is a superuser, and superusers ignore row-level
 * security unconditionally — a test written against that connection would pass
 * while proving nothing.
 */

const ID = "zztest-gate";
const TEST_PASSWORD = "gate-dbtest-local-only";

let alpha = "";
let bravo = "";
let appDb: PrismaClient;

function appUrl() {
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.username = "motion_app";
    url.password = TEST_PASSWORD;
    return url.toString();
}

async function asTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('motion.tenant_id', $1, true)`, tenantId);
        return fn(tx as unknown as PrismaClient);
    });
}

before(async () => {
    await prisma.$executeRawUnsafe(`ALTER ROLE motion_app WITH PASSWORD '${TEST_PASSWORD}'`);

    const a = await prisma.tenant.create({
        data: { status: "ACTIVE", slug: `${ID}-a`, name: "ZZTEST Gate Alpha", country: "NA" },
        select: { id: true },
    });
    const b = await prisma.tenant.create({
        data: { status: "ACTIVE", slug: `${ID}-b`, name: "ZZTEST Gate Bravo", country: "NA" },
        select: { id: true },
    });
    alpha = a.id;
    bravo = b.id;

    await prisma.subscription.create({
        data: { tenantId: alpha, planId: "workshop", planName: "Workshop", priceAmount: 1200, reference: "MOT-ZZTSTA" },
    });
    await prisma.subscription.create({
        data: { tenantId: bravo, planId: "full", planName: "Full workshop", priceAmount: 2400, reference: "MOT-ZZTSTB" },
    });

    appDb = new PrismaClient({ datasourceUrl: appUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    await prisma.subscription.deleteMany({ where: { reference: { startsWith: "MOT-ZZTST" } } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: ID } } });
});

// ── the derivation ───────────────────────────────────────────────────────────

test("a newly registered workshop is not active, however it was created", async () => {
    // Including when the caller insists otherwise. A create that passes
    // isActive: true is exactly the mistake that would give the product away,
    // so it has to be the database that refuses.
    const t = await prisma.tenant.create({
        data: { slug: `${ID}-trigger`, name: "ZZTEST Gate Trigger", country: "NA", isActive: true },
        select: { status: true, isActive: true },
    });
    assert.equal(t.status, "PENDING_PAYMENT", "the default must be the locked state");
    assert.equal(t.isActive, false, "a tenant awaiting payment was let in");
});

test("confirming a payment is what lets a workshop in", async () => {
    const t = await prisma.tenant.update({
        where: { slug: `${ID}-trigger` },
        data: { status: "ACTIVE" },
        select: { isActive: true },
    });
    assert.equal(t.isActive, true);
});

test("an unpaid renewal does not lock a workshop out of its own floor", async () => {
    // The terms of service promise this in writing: "After it, MOTION becomes
    // read-only: you can still see everything, still print, still export, still
    // get your books out", and "we do not lock a workshop out of its own
    // floor". So PAST_DUE stays active and the write refusal belongs above the
    // database. If this goes red, the product is breaking a published promise.
    const t = await prisma.tenant.update({
        where: { slug: `${ID}-trigger` },
        data: { status: "PAST_DUE" },
        select: { isActive: true },
    });
    assert.equal(t.isActive, true, "PAST_DUE closed the door, which the terms say it must not");
});

test("writing isActive directly cannot contradict the status", async () => {
    const t = await prisma.tenant.update({
        where: { slug: `${ID}-trigger` },
        data: { status: "SUSPENDED", isActive: true },
        select: { status: true, isActive: true },
    });
    assert.equal(t.status, "SUSPENDED");
    assert.equal(t.isActive, false, "a suspended workshop stayed reachable because something set the boolean by hand");
});

// ── the subscription is the workshop's own ───────────────────────────────────

test("a connection with no tenant set cannot read any subscription", async () => {
    const rows = await appDb.subscription.findMany({ where: { reference: { startsWith: "MOT-ZZTST" } } });
    assert.equal(rows.length, 0, "an unset connection could read what every workshop pays");
});

test("a workshop sees its own subscription and not its neighbour's", async () => {
    const mine = await asTenant(alpha, (tx) => tx.subscription.findMany({}));
    assert.equal(mine.length, 1);
    assert.equal(mine[0].reference, "MOT-ZZTSTA");

    const theirs = await asTenant(alpha, (tx) => tx.subscription.findMany({ where: { reference: "MOT-ZZTSTB" } }));
    assert.equal(theirs.length, 0, "one workshop could read another's subscription");
});

test("a workshop cannot write a subscription for somebody else", async () => {
    // The WITH CHECK half of the policy. Without it a tenant could insert rows
    // it cannot then see, which is how one workshop quietly changes what
    // another is charged.
    await assert.rejects(
        () =>
            asTenant(alpha, (tx) =>
                tx.subscription.create({
                    data: { tenantId: bravo, planId: "workshop", planName: "Workshop", priceAmount: 1, reference: "MOT-ZZTSTX" },
                }),
            ),
        /row-level security|violates/i,
    );
});

test("two workshops cannot share a payment reference", async () => {
    // The reference is what matches a line on a bank statement to a workshop.
    // Two the same is a deposit nobody can attribute, so this is not tidiness.
    await assert.rejects(
        () =>
            prisma.subscription.create({
                data: { tenantId: bravo, planId: "workshop", planName: "Workshop", priceAmount: 1200, reference: "MOT-ZZTSTA" },
            }),
        /Unique constraint|duplicate key/i,
    );
});
