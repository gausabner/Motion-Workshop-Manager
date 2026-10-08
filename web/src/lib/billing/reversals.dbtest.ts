import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appRoleUrl, prepareAppRole } from "@/lib/testing/app-role";
import { issueInvoice } from "@/lib/billing/invoices";
import { reversePayment } from "@/lib/billing/reversals";
import { renderSubscriptionCreditNotePdf } from "@/lib/pdf/subscription-invoice";

/**
 * Reversing payments recorded in error — the case that prompted it, played
 * back: one workshop renewed three times in a row by mistake, then undone
 * newest first, each with a credit note cancelling its invoice.
 */

const SLUG = "zztest-reversal";
const DAY = 24 * 60 * 60 * 1000;
const E0 = new Date("2026-11-07T15:32:19Z");
const E1 = new Date("2026-12-07T15:32:19Z");
const E2 = new Date("2027-01-07T15:32:19Z");
const E3 = new Date("2027-02-07T15:32:19Z");

let tenantId = "";
let otherId = "";
let staffId = "";
let subId = "";
const pay: string[] = [];
let appDb: PrismaClient;

async function payment(from: Date, to: Date) {
    const p = await prisma.subscriptionPayment.create({
        data: { tenantId, subscriptionId: subId, amountExclVat: 2400, amountInclVat: 2760, periodFrom: from, periodTo: to, confirmedById: staffId },
        select: { id: true },
    });
    await prisma.$transaction((tx) => issueInvoice(tx, p.id));
    return p.id;
}

const reverse = (paymentId: string, reason = "Recorded three times by mistake.") =>
    prisma.$transaction((tx) => reversePayment(tx, { tenantId, paymentId, staffId, reason, now: new Date() }));

const paidUpTo = async () => (await prisma.subscription.findUniqueOrThrow({ where: { id: subId }, select: { periodEndsAt: true } })).periodEndsAt;

before(async () => {
    await prepareAppRole(prisma);
    const t = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Reversal", country: "NA" }, select: { id: true } });
    tenantId = t.id;
    const o = await prisma.tenant.create({ data: { status: "ACTIVE", slug: `${SLUG}-other`, name: "ZZTEST Reversal Other", country: "NA" }, select: { id: true } });
    otherId = o.id;
    const u = await prisma.user.create({ data: { email: `${SLUG}@example.invalid`, passwordHash: "x", firstName: "ZZTEST", lastName: "Staff", isPlatformStaff: true }, select: { id: true } });
    staffId = u.id;
    const s = await prisma.subscription.create({
        data: { tenantId, planId: "full", planName: "Full workshop", priceAmount: 2400, reference: "MOT-ZZREVA", status: "ACTIVE", startedAt: new Date("2026-10-07T15:32:19Z"), periodEndsAt: E3 },
        select: { id: true },
    });
    subId = s.id;
    // Three renewals, as recorded by three presses of the same button.
    pay.push(await payment(E0, E1), await payment(E1, E2), await payment(E2, E3));
    appDb = new PrismaClient({ datasourceUrl: appRoleUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.subscriptionCreditNote.deleteMany({ where: { tenantId } });
        await tx.subscriptionInvoice.deleteMany({ where: { tenantId } });
    });
    await prisma.subscriptionPayment.deleteMany({ where: { tenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG } } });
    await prisma.user.deleteMany({ where: { email: `${SLUG}@example.invalid` } });
});

test("a payment from the middle cannot be reversed — newest first", async () => {
    const result = await reverse(pay[0]);
    assert.equal(result.ok, false);
    const newest = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: pay[2] }, select: { number: true } });
    assert.match((result as { message: string }).message, new RegExp(`Reverse ${newest.number} first`));
    assert.equal((await paidUpTo())?.toISOString(), E3.toISOString(), "a refused reversal moved the date");
});

test("a reason is required, because it is printed on the credit note", async () => {
    const result = await reverse(pay[2], "oops");
    assert.equal(result.ok, false);
});

test("reversing the newest cancels its invoice with a credit note and walks the date back one period", async () => {
    const result = await reverse(pay[2]);
    assert.equal(result.ok, true);
    const ok = result as Extract<typeof result, { ok: true }>;
    assert.ok(ok.creditNote);
    assert.match(ok.creditNote!.number, /CN-\d{5}$/);
    assert.equal((await paidUpTo())?.toISOString(), E2.toISOString());

    const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { paymentId: pay[2] } });
    assert.equal(ok.creditNote!.invoiceId, invoice.id);
    assert.equal(Number(ok.creditNote!.amountInclVat), Number(invoice.amountInclVat));
    assert.deepEqual(ok.creditNote!.recipient, invoice.recipient, "the credit note must name the same workshop as the invoice");
    assert.match(ok.creditNote!.description, new RegExp(invoice.number));
    assert.ok((await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: pay[2] } })).reversedAt, "the payment was not marked reversed");
});

test("the same payment cannot be reversed twice", async () => {
    const again = await reverse(pay[2]);
    assert.equal(again.ok, false);
    assert.match((again as { message: string }).message, /already been reversed/);
});

test("the rest unwind in order, with credit notes numbered one after another", async () => {
    const second = await reverse(pay[1]);
    const first = await reverse(pay[0]);
    assert.equal(second.ok && first.ok, true);
    assert.equal((await paidUpTo())?.toISOString(), E0.toISOString(), "three reversals did not bring the date back to where it started");
    const notes = await prisma.subscriptionCreditNote.findMany({ where: { tenantId }, orderBy: { serial: "asc" }, select: { serial: true } });
    assert.equal(notes.length, 3);
    assert.equal(notes[2].serial - notes[0].serial, 2, "credit note numbers have a gap");
});

test("a payment whose date was since changed by hand is not walked back", async () => {
    const p = await payment(E0, E1);
    await prisma.subscription.update({ where: { id: subId }, data: { periodEndsAt: new Date(E1.getTime() + 10 * DAY) } });
    const result = await reverse(p);
    assert.equal(result.ok, false);
    assert.match((result as { message: string }).message, /changed by hand/);
});

test("a credit note is as final as an invoice", async () => {
    const note = await prisma.subscriptionCreditNote.findFirstOrThrow({ where: { tenantId } });
    await assert.rejects(() => prisma.subscriptionCreditNote.update({ where: { id: note.id }, data: { reason: "edited" } }), /MOTION_TAX_RECORD/);
    await assert.rejects(() => prisma.subscriptionCreditNote.delete({ where: { id: note.id } }), /MOTION_TAX_RECORD/);
    const sent = await prisma.subscriptionCreditNote.update({ where: { id: note.id }, data: { emailedAt: new Date() } });
    assert.ok(sent.emailedAt);
});

test("it renders to a PDF", async () => {
    const note = await prisma.subscriptionCreditNote.findFirstOrThrow({ where: { tenantId }, include: { invoice: { select: { number: true, issuedAt: true } } } });
    const pdf = await renderSubscriptionCreditNotePdf(note, note.invoice);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});

test("a workshop sees its own credit notes and no other workshop's", async () => {
    const inTx = <T,>(settings: Record<string, string>, fn: (tx: PrismaClient) => Promise<T>) =>
        appDb.$transaction(async (tx) => {
            for (const [k, v] of Object.entries(settings)) await tx.$executeRawUnsafe(`SELECT set_config($1, $2, true)`, k, v);
            return fn(tx as unknown as PrismaClient);
        });
    const scope = { tenantId: { in: [tenantId, otherId] } };
    assert.equal((await inTx({ "motion.tenant_id": otherId }, (tx) => tx.subscriptionCreditNote.findMany({ where: scope }))).length, 0);
    assert.equal((await inTx({ "motion.tenant_id": tenantId }, (tx) => tx.subscriptionCreditNote.findMany({ where: scope }))).length, 3);
    assert.equal((await inTx({}, (tx) => tx.subscriptionCreditNote.findMany({ where: scope }))).length, 0);
    assert.equal((await inTx({ "motion.platform_admin": "on" }, (tx) => tx.subscriptionCreditNote.findMany({ where: scope }))).length, 3);
});
