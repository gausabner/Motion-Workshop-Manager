import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appRoleUrl, prepareAppRole } from "@/lib/testing/app-role";
import { runRenewalTick } from "@/lib/billing/renewals";

/**
 * Renewals, where they are enforced.
 *
 * Three guarantees, each of which fails quietly if it fails at all:
 *
 * - **A past-due workshop cannot raise a document**, by any path. The terms
 *   promise it, and the database holds it; this inserts directly, past every
 *   check the application makes.
 * - **A workshop's payment history is its own.** `SubscriptionPayment` is
 *   FORCE RLS, readable by its workshop and by staff, and by nobody else.
 * - **The daily run does each thing once.** Reminded once per period, made
 *   read-only once, and never touching a workshop a person suspended.
 */

const ID = "zztest-renew";
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-20T05:00:00Z");

let readOnlyId = "";
let dueSoonId = "";
let suspendedId = "";
let otherId = "";
let appDb: PrismaClient;

async function tenant(slug: string, status: "ACTIVE" | "SUSPENDED", periodEndsAt: Date, ref: string) {
    const t = await prisma.tenant.create({ data: { status, slug: `${ID}-${slug}`, name: `ZZTEST Renew ${slug}`, country: "NA" }, select: { id: true } });
    await prisma.subscription.create({
        data: { tenantId: t.id, planId: "workshop", planName: "Workshop", priceAmount: 1200, reference: ref, status: "ACTIVE", startedAt: periodEndsAt, periodEndsAt },
    });
    return t.id;
}

before(async () => {
    await prepareAppRole(prisma);
    // Due 10 days before NOW: past a 7-day grace.
    readOnlyId = await tenant("late", "ACTIVE", new Date(NOW.getTime() - 10 * DAY), "MOT-ZZRNWA");
    // Due in 3 days: inside the reminder window.
    dueSoonId = await tenant("soon", "ACTIVE", new Date(NOW.getTime() + 3 * DAY), "MOT-ZZRNWB");
    // Long overdue, but a person suspended it — the clock must leave it alone.
    suspendedId = await tenant("held", "SUSPENDED", new Date(NOW.getTime() - 40 * DAY), "MOT-ZZRNWC");
    otherId = await tenant("other", "ACTIVE", new Date(NOW.getTime() + 60 * DAY), "MOT-ZZRNWD");
    appDb = new PrismaClient({ datasourceUrl: appRoleUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    const ids = [readOnlyId, dueSoonId, suspendedId, otherId].filter(Boolean);
    await prisma.platformAuditEvent.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.document.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.subscription.deleteMany({ where: { reference: { startsWith: "MOT-ZZRNW" } } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: ID } } });
});

const ALL = () => [readOnlyId, dueSoonId, suspendedId, otherId];
const proof = { schedulerSecretChecked: true as const };

// ── the daily run ────────────────────────────────────────────────────────────

test("the run makes the late workshop read-only and reminds the one due soon — nothing else", async () => {
    const summary = await runRenewalTick(proof, NOW, ALL());
    assert.equal(summary.checked, 3, "the suspended workshop is not even looked at");
    assert.equal(summary.readOnly, 1);
    assert.equal(summary.reminded, 1);

    const statuses = await prisma.tenant.findMany({ where: { id: { in: ALL() } }, select: { id: true, status: true } });
    const of = (id: string) => statuses.find((s) => s.id === id)?.status;
    assert.equal(of(readOnlyId), "PAST_DUE");
    assert.equal(of(dueSoonId), "ACTIVE");
    assert.equal(of(suspendedId), "SUSPENDED", "the clock overruled a person");
    assert.equal(of(otherId), "ACTIVE");

    const trail = await prisma.platformAuditEvent.findMany({ where: { tenantId: readOnlyId } });
    assert.equal(trail.length, 1);
    assert.equal(trail[0].action, "PAST_DUE");
    assert.equal(trail[0].actorUserId, null, "an automatic move borrowed somebody's name");
});

test("running again the same morning does nothing at all", async () => {
    const summary = await runRenewalTick(proof, new Date(NOW.getTime() + 60_000), ALL());
    assert.equal(summary.readOnly, 0);
    assert.equal(summary.reminded, 0);
    assert.equal(await prisma.platformAuditEvent.count({ where: { tenantId: readOnlyId } }), 1);
});

// ── read-only, in the database ───────────────────────────────────────────────

test("a past-due workshop cannot insert a document, even past every application check", async () => {
    await assert.rejects(
        () => prisma.document.create({ data: { tenantId: readOnlyId, type: "QUOTE", state: "DRAFT" } }),
        /MOTION_READ_ONLY/,
    );
});

test("a workshop in good standing still can", async () => {
    const doc = await prisma.document.create({ data: { tenantId: otherId, type: "QUOTE", state: "DRAFT" }, select: { id: true } });
    assert.ok(doc.id);
});

// ── payment history ──────────────────────────────────────────────────────────

async function inTx<T>(settings: Record<string, string>, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return appDb.$transaction(async (tx) => {
        for (const [key, value] of Object.entries(settings)) await tx.$executeRawUnsafe(`SELECT set_config($1, $2, true)`, key, value);
        return fn(tx as unknown as PrismaClient);
    });
}

test("a workshop reads its own payment history, not another's; staff read both", async () => {
    for (const [tenantId, ref] of [[dueSoonId, "MOT-ZZRNWB"], [otherId, "MOT-ZZRNWD"]] as const) {
        const sub = await prisma.subscription.findUniqueOrThrow({ where: { reference: ref }, select: { id: true } });
        await prisma.subscriptionPayment.create({
            data: { tenantId, subscriptionId: sub.id, amountExclVat: 1200, amountInclVat: 1380, periodFrom: NOW, periodTo: new Date(NOW.getTime() + 30 * DAY) },
        });
    }
    const scope = { tenantId: { in: [dueSoonId, otherId] } };

    const none = await inTx({}, (tx) => tx.subscriptionPayment.findMany({ where: scope }));
    assert.equal(none.length, 0, "a session that declared nothing read payments");

    const own = await inTx({ "motion.tenant_id": dueSoonId }, (tx) => tx.subscriptionPayment.findMany({ where: scope }));
    assert.deepEqual(own.map((p) => p.tenantId), [dueSoonId]);

    const staff = await inTx({ "motion.platform_admin": "on" }, (tx) => tx.subscriptionPayment.findMany({ where: scope }));
    assert.equal(staff.length, 2);
});

test("a workshop cannot write a payment against another workshop", async () => {
    // Recording payments is a staff act and no workshop code path writes here.
    // The policy still has to hold if one ever does: a row naming somebody
    // else's workshop is refused.
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { reference: "MOT-ZZRNWB" }, select: { id: true } });
    await assert.rejects(
        () =>
            inTx({ "motion.tenant_id": dueSoonId }, (tx) =>
                tx.subscriptionPayment.create({
                    data: { tenantId: otherId, subscriptionId: sub.id, amountExclVat: 1, amountInclVat: 1, periodFrom: NOW, periodTo: NOW },
                }),
            ),
        /row-level security|violates/i,
        "a workshop wrote a payment against another workshop",
    );
});
