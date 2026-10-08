import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appRoleUrl, prepareAppRole } from "@/lib/testing/app-role";
import { issueInvoice } from "@/lib/billing/invoices";
import { renderSubscriptionInvoicePdf } from "@/lib/pdf/subscription-invoice";

/**
 * Tax invoices, where they are enforced.
 *
 * - **Numbers have no gaps and no duplicates**, even when two payments are
 *   recorded at the same moment.
 * - **An issued invoice is final.** The database refuses to change anything
 *   on it but the date it was emailed, and refuses to delete it.
 * - **It prints what it was issued with**, not what the workshop says today.
 * - **A workshop sees its own invoices and nobody else's.**
 */

const ID = "zztest-invoice";
const DAY = 24 * 60 * 60 * 1000;
const FROM = new Date("2026-10-07T10:00:00Z");
const TO = new Date(FROM.getTime() + 31 * DAY);

let alpha = "";
let bravo = "";
const paymentIds: string[] = [];
let appDb: PrismaClient;

async function workshop(slug: string, ref: string) {
    const t = await prisma.tenant.create({
        data: {
            status: "ACTIVE",
            slug: `${ID}-${slug}`,
            name: `ZZTEST Invoice ${slug}`,
            country: "NA",
            address1: "12 Test Street",
            city: "Windhoek",
            vatNumber: "99999999-015",
        },
        select: { id: true },
    });
    const sub = await prisma.subscription.create({
        data: { tenantId: t.id, planId: "full", planName: "Full workshop", priceAmount: 2400, reference: ref, status: "ACTIVE", startedAt: FROM, periodEndsAt: TO },
        select: { id: true },
    });
    return { tenantId: t.id, subscriptionId: sub.id };
}

async function payment(w: { tenantId: string; subscriptionId: string }) {
    const p = await prisma.subscriptionPayment.create({
        data: { tenantId: w.tenantId, subscriptionId: w.subscriptionId, amountExclVat: 2400, amountInclVat: 2760, periodFrom: FROM, periodTo: TO },
        select: { id: true },
    });
    paymentIds.push(p.id);
    return p.id;
}

let a: { tenantId: string; subscriptionId: string };
let b: { tenantId: string; subscriptionId: string };

before(async () => {
    await prepareAppRole(prisma);
    a = await workshop("alpha", "MOT-ZZINVA");
    b = await workshop("bravo", "MOT-ZZINVB");
    alpha = a.tenantId;
    bravo = b.tenantId;
    appDb = new PrismaClient({ datasourceUrl: appRoleUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    // Invoices are final by trigger, which is the point — so the clean-up
    // switches triggers off for its own transaction, as only a superuser can.
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.subscriptionInvoice.deleteMany({ where: { tenantId: { in: [alpha, bravo] } } });
    });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId: { in: [alpha, bravo] } } });
    await prisma.subscription.deleteMany({ where: { reference: { startsWith: "MOT-ZZINV" } } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: ID } } });
});

// ── numbering ────────────────────────────────────────────────────────────────

test("two payments recorded at the same moment get consecutive numbers, not the same one", async () => {
    const [p1, p2] = [await payment(a), await payment(b)];
    const [i1, i2] = await Promise.all([prisma.$transaction((tx) => issueInvoice(tx, p1)), prisma.$transaction((tx) => issueInvoice(tx, p2))]);
    assert.equal(Math.abs(i1.serial - i2.serial), 1, `serials ${i1.serial} and ${i2.serial}`);
    assert.notEqual(i1.number, i2.number);
    assert.match(i1.number, /^[A-Z]+-\d{5}$/);
});

test("issuing again for the same payment returns the same invoice", async () => {
    const p = paymentIds[0];
    const first = await prisma.$transaction((tx) => issueInvoice(tx, p));
    const again = await prisma.$transaction((tx) => issueInvoice(tx, p));
    assert.equal(again.id, first.id);
    assert.equal(again.number, first.number);
});

test("a transaction that rolls back gives its number back", async () => {
    const before = await prisma.subscriptionInvoice.aggregate({ _max: { serial: true } });
    const p = await payment(a);
    await assert.rejects(() =>
        prisma.$transaction(async (tx) => {
            await issueInvoice(tx, p);
            throw new Error("abandoned");
        }),
    );
    const issued = await prisma.$transaction((tx) => issueInvoice(tx, p));
    assert.equal(issued.serial, (before._max.serial ?? 0) + 1, "a rolled-back invoice left a gap");
});

// ── what it says ─────────────────────────────────────────────────────────────

test("an invoice carries the workshop as it was, and the amounts add up", async () => {
    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: paymentIds[0] } });
    const recipient = invoice.recipient as { name: string; vatNumber: string; addressLines: string[] };
    assert.equal(recipient.name, "ZZTEST Invoice alpha");
    assert.equal(recipient.vatNumber, "99999999-015");
    assert.ok(recipient.addressLines.includes("12 Test Street"));
    assert.equal(Number(invoice.amountExclVat) + Number(invoice.vatAmount), Number(invoice.amountInclVat));
    assert.equal(Number(invoice.vatAmount), 360);

    // The workshop renames itself. Its issued invoice does not.
    await prisma.tenant.update({ where: { id: alpha }, data: { name: "ZZTEST Renamed" } });
    const reread = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal((reread.recipient as { name: string }).name, "ZZTEST Invoice alpha");
});

test("it renders to a PDF", async () => {
    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: paymentIds[0] } });
    const pdf = await renderSubscriptionInvoicePdf(invoice);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 2000);
});

// ── final once issued ────────────────────────────────────────────────────────

test("nothing on an issued invoice can be changed except when it was emailed", async () => {
    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: paymentIds[0] } });
    await assert.rejects(() => prisma.subscriptionInvoice.update({ where: { id: invoice.id }, data: { amountInclVat: 1 } }), /MOTION_TAX_RECORD/);
    await assert.rejects(() => prisma.subscriptionInvoice.update({ where: { id: invoice.id }, data: { number: "EDITED-1" } }), /MOTION_TAX_RECORD/);
    const sent = await prisma.subscriptionInvoice.update({ where: { id: invoice.id }, data: { emailedAt: new Date() } });
    assert.ok(sent.emailedAt);
});

test("an issued invoice cannot be deleted, nor its payment or workshop removed from under it", async () => {
    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: paymentIds[0] } });
    await assert.rejects(() => prisma.subscriptionInvoice.delete({ where: { id: invoice.id } }), /MOTION_TAX_RECORD/);
    await assert.rejects(() => prisma.subscriptionPayment.delete({ where: { id: paymentIds[0] } }), /foreign key|violates|Foreign key/i);
    await assert.rejects(() => prisma.tenant.delete({ where: { id: alpha } }), /foreign key|violates|Foreign key|MOTION_TAX_RECORD/i);
});

// ── who sees it ──────────────────────────────────────────────────────────────

async function inTx<T>(settings: Record<string, string>, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return appDb.$transaction(async (tx) => {
        for (const [key, value] of Object.entries(settings)) await tx.$executeRawUnsafe(`SELECT set_config($1, $2, true)`, key, value);
        return fn(tx as unknown as PrismaClient);
    });
}

test("a workshop sees its own invoices only; staff see both; nobody else sees any", async () => {
    const scope = { tenantId: { in: [alpha, bravo] } };
    assert.equal((await inTx({}, (tx) => tx.subscriptionInvoice.findMany({ where: scope }))).length, 0);

    const own = await inTx({ "motion.tenant_id": bravo }, (tx) => tx.subscriptionInvoice.findMany({ where: scope }));
    assert.ok(own.length >= 1);
    assert.ok(own.every((i) => i.tenantId === bravo), "a workshop read another workshop's invoice");

    const staff = await inTx({ "motion.platform_admin": "on" }, (tx) => tx.subscriptionInvoice.findMany({ where: scope }));
    assert.ok(staff.some((i) => i.tenantId === alpha) && staff.some((i) => i.tenantId === bravo));
});
