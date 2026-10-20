import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { appRoleUrl, prepareAppRole } from "@/lib/testing/app-role";
import { createChange, pendingChange, withdrawChange } from "@/lib/billing/plan-change-service";
import { applyPlanChange, declinePlanChange } from "@/lib/billing/plan-change-staff";
import { addPeriod, anchorDayOf } from "@/lib/billing/periods";

/**
 * A workshop asking to move plan, and MOTION deciding it, against a real
 * database: one request at a time, a move up that records its payment and
 * restarts the paid-up-to date, a move down that changes the plan with no
 * payment, a decline that keeps its reason, and the wall between workshops.
 */

const SLUG = "zztest-planchange";
const DAY = 24 * 60 * 60 * 1000;

let tenantId = "";
let otherId = "";
let ownerId = "";
let staffId = "";
let subId = "";
let appDb: PrismaClient;

const db = () => forTenant(tenantId);
const sub = () => prisma.subscription.findUniqueOrThrow({ where: { id: subId }, select: { planId: true, planName: true, priceAmount: true, periodEndsAt: true, startedAt: true } });
const tenantRow = () => prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { status: true } });
const ask = (toPlanId: string, now = new Date()) => createChange(db(), { tenantId, tenantStatus: "ACTIVE", userId: ownerId, toPlanId, now });
const subscriptionFor = async () => {
    const s = await prisma.subscription.findUniqueOrThrow({ where: { id: subId }, select: { id: true, status: true, period: true, periodEndsAt: true } });
    return s;
};
const apply = async (requestId: string, now = new Date()) => {
    const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { id: true, name: true, status: true } });
    const s = await subscriptionFor();
    return prisma.$transaction((tx) => applyPlanChange(tx, { staffId, tenant: t, subscription: s, requestId, now }));
};

before(async () => {
    await prepareAppRole(prisma);
    tenantId = (await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Plan Change", country: "NA" }, select: { id: true } })).id;
    otherId = (await prisma.tenant.create({ data: { status: "ACTIVE", slug: `${SLUG}-other`, name: "ZZTEST Plan Change Other", country: "NA" }, select: { id: true } })).id;
    ownerId = (await prisma.user.create({ data: { email: `${SLUG}-owner@example.invalid`, passwordHash: "x", firstName: "Owner", lastName: "ZZTEST" }, select: { id: true } })).id;
    staffId = (await prisma.user.create({ data: { email: `${SLUG}-staff@example.invalid`, passwordHash: "x", firstName: "Staff", lastName: "ZZTEST", isPlatformStaff: true }, select: { id: true } })).id;
    await prisma.membership.create({ data: { tenantId, userId: ownerId, group: "OWNER", status: "ACTIVE" } });
    subId = (
        await prisma.subscription.create({
            data: {
                tenantId,
                planId: "workshop",
                planName: "Workshop",
                priceAmount: 1200,
                reference: "MOT-ZZPLAN",
                status: "ACTIVE",
                startedAt: new Date(Date.now() - 12 * DAY),
                periodEndsAt: new Date(Date.now() + 18 * DAY),
            },
            select: { id: true },
        })
    ).id;
    appDb = new PrismaClient({ datasourceUrl: appRoleUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    await prisma.planChangeRequest.deleteMany({ where: { tenantId } });
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.subscriptionInvoice.deleteMany({ where: { tenantId } });
    });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("a move up is logged with one full period at the new price to pay, and only one can be open", async () => {
    const first = await ask("full");
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.change.request.kind, "upgrade");
    assert.equal(first.change.request.amountExclVat, 2400);
    assert.equal(first.change.request.amountInclVat, 2760);
    assert.equal(first.change.reference, "MOT-ZZPLAN");
    assert.ok(first.change.unusedDays >= 17 && first.change.unusedDays <= 18);
    assert.ok(first.change.gained.includes("Purchasing and suppliers"));

    const second = await ask("full");
    assert.equal(second.ok, false);
    assert.match((second as { message: string }).message, /already have a plan change waiting/);
    assert.equal((await sub()).planId, "workshop", "asking changed the plan");
});

test("a workshop sees its own request and no other workshop's", async () => {
    assert.ok(await pendingChange(db(), tenantId));
    assert.equal(await pendingChange(forTenant(otherId), otherId), null);

    const inTx = <T,>(settings: Record<string, string>, fn: (tx: PrismaClient) => Promise<T>) =>
        appDb.$transaction(async (tx) => {
            for (const [k, v] of Object.entries(settings)) await tx.$executeRawUnsafe(`SELECT set_config($1, $2, true)`, k, v);
            return fn(tx as unknown as PrismaClient);
        });
    const scope = { tenantId: { in: [tenantId, otherId] } };
    assert.equal((await inTx({ "motion.tenant_id": otherId }, (tx) => tx.planChangeRequest.findMany({ where: scope }))).length, 0);
    assert.equal((await inTx({ "motion.tenant_id": tenantId }, (tx) => tx.planChangeRequest.findMany({ where: scope }))).length, 1);
    assert.equal((await inTx({}, (tx) => tx.planChangeRequest.findMany({ where: scope }))).length, 0);
    assert.equal((await inTx({ "motion.platform_admin": "on" }, (tx) => tx.planChangeRequest.findMany({ where: scope }))).length, 1);
});

test("a withdrawn request can be asked again", async () => {
    const open = await pendingChange(db(), tenantId);
    assert.ok(open);
    assert.equal(await withdrawChange(db(), tenantId, open.id), true);
    assert.equal(await withdrawChange(db(), tenantId, open.id), false, "withdrew twice");
    assert.equal(await pendingChange(db(), tenantId), null);
    assert.equal((await ask("full")).ok, true);
});

test("approving a move up records the payment, issues the invoice, and restarts the paid-up-to date from that day", async () => {
    const open = await pendingChange(db(), tenantId);
    assert.ok(open);
    // A read-only workshop paying for a move up is back to full access with it.
    await prisma.tenant.update({ where: { id: tenantId }, data: { status: "PAST_DUE" } });

    const now = new Date();
    const result = await apply(open.id, now);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.applied.restored, true);
    assert.equal((await tenantRow()).status, "ACTIVE");

    const s = await sub();
    assert.equal(s.planId, "full");
    assert.equal(s.planName, "Full workshop");
    assert.equal(Number(s.priceAmount), 2400);
    assert.equal(s.startedAt?.toISOString(), now.toISOString());
    assert.equal(s.periodEndsAt?.toISOString(), addPeriod(now, "MONTHLY", anchorDayOf(now)).toISOString());

    const req = await prisma.planChangeRequest.findUniqueOrThrow({
        where: { id: open.id },
        select: { status: true, decidedById: true, payment: { select: { amountInclVat: true, invoice: { select: { description: true, amountInclVat: true } } } } },
    });
    assert.equal(req.status, "APPROVED");
    assert.equal(req.decidedById, staffId);
    assert.equal(Number(req.payment?.amountInclVat), 2760);
    assert.match(req.payment?.invoice?.description ?? "", /Full workshop plan/);
    assert.equal(Number(req.payment?.invoice?.amountInclVat), 2760);

    const again = await apply(open.id);
    assert.equal(again.ok, false);
    assert.equal((again as { stale: boolean }).stale, true, "a second approval did something");
    assert.equal(await prisma.subscriptionPayment.count({ where: { tenantId } }), 1);
});

test("approving a move down changes the plan now, with no payment, and keeps the paid-up-to date", async () => {
    const before = (await sub()).periodEndsAt;
    const asked = await ask("workshop");
    assert.equal(asked.ok, true);
    if (!asked.ok) return;
    assert.equal(asked.change.request.kind, "downgrade");
    assert.equal(asked.change.request.amountInclVat, 0);
    assert.ok(asked.change.lost.includes("Parts and stock"));

    const result = await apply(asked.change.request.id);
    assert.equal(result.ok, true);
    const s = await sub();
    assert.equal(s.planId, "workshop");
    assert.equal(Number(s.priceAmount), 1200);
    assert.equal(s.periodEndsAt?.toISOString(), before?.toISOString());
    assert.equal(await prisma.subscriptionPayment.count({ where: { tenantId } }), 1, "a move down recorded a payment");
});

test("a declined request keeps its reason and cannot be decided twice", async () => {
    const asked = await ask("full");
    assert.equal(asked.ok, true);
    if (!asked.ok) return;
    const reason = "No payment arrived under the reference after 14 days.";
    const declined = await prisma.$transaction((tx) => declinePlanChange(tx, { staffId, tenantId, requestId: asked.change.request.id, reason, now: new Date() }));
    assert.equal(declined?.toPlanName, "Full workshop");
    const row = await prisma.planChangeRequest.findUniqueOrThrow({ where: { id: asked.change.request.id }, select: { status: true, declineReason: true } });
    assert.equal(row.status, "DECLINED");
    assert.equal(row.declineReason, reason);
    assert.equal(await prisma.$transaction((tx) => declinePlanChange(tx, { staffId, tenantId, requestId: asked.change.request.id, reason, now: new Date() })), null);
    assert.equal((await sub()).planId, "workshop");
});
