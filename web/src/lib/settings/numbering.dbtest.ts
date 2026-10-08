import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { SequenceKey } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { loadNumbering, saveNumbering, type NumberingInput } from "@/lib/settings/numbering";

/**
 * A workshop's own document numbers, against a real database — because the
 * guarantee that matters, "no number is ever issued twice", is about what is
 * already in the tables.
 */

const SLUG = "zztest-numbering";
let tenantId = "";
let userId = "";

before(async () => {
    const t = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Numbering", country: "NA" }, select: { id: true } });
    tenantId = t.id;
    const u = await prisma.user.create({ data: { email: `${SLUG}@example.invalid`, passwordHash: "x", firstName: "ZZTEST", lastName: "Numbers" }, select: { id: true } });
    userId = u.id;
    // Already on the books: an invoice under today's prefix, one under a prefix
    // the workshop used before, and a quote.
    for (const [type, number] of [["INVOICE", "INV-1003"], ["INVOICE", "OLD-1500"], ["QUOTE", "Q-1001"]] as const) {
        await prisma.document.create({ data: { tenantId, type, state: "PROCESSED", number } });
    }
});

after(async () => {
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.sequence.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: SLUG } });
    await prisma.user.deleteMany({ where: { email: `${SLUG}@example.invalid` } });
});

const db = () => forTenant(tenantId);
const only = (key: SequenceKey, prefix: string, next: number): NumberingInput => new Map([[key, { prefix, next }]]);
const allocate = (key: SequenceKey) => db().$transaction((tx) => allocateNumber(tx, tenantId, key));

test("an unused series shows its defaults, and the highest number already issued", async () => {
    const rows = await loadNumbering(db(), tenantId);
    const invoice = rows.find((r) => r.key === "INVOICE")!;
    assert.equal(invoice.prefix, "INV-");
    assert.equal(invoice.next, 1001);
    assert.equal(invoice.lastIssued, "INV-1003");
    assert.equal(rows.find((r) => r.key === "CREDIT")!.lastIssued, null);
});

test("a series cannot be set to re-issue a number it already used", async () => {
    const result = await saveNumbering(db(), tenantId, userId, only("INVOICE", "INV-", 1003));
    assert.equal(result.ok, false);
    assert.match((result as { errors: Record<string, string[]> }).errors.next_INVOICE[0], /INV-1003 has already been issued/);
});

test("moving a series forward is saved, and the next invoice takes that number", async () => {
    const result = await saveNumbering(db(), tenantId, userId, only("INVOICE", "INV-", 1004));
    assert.equal(result.ok, true);
    assert.equal(await allocate("INVOICE"), "INV-1004");
    assert.equal(await allocate("INVOICE"), "INV-1005");
});

test("a new prefix can start anywhere", async () => {
    assert.equal((await saveNumbering(db(), tenantId, userId, only("INVOICE", "TT/INV/", 1))).ok, true);
    assert.equal(await allocate("INVOICE"), "TT/INV/1");
});

test("going back to an old prefix has to continue past what it issued", async () => {
    const refused = await saveNumbering(db(), tenantId, userId, only("INVOICE", "OLD-", 1001));
    assert.equal(refused.ok, false);
    assert.equal((await saveNumbering(db(), tenantId, userId, only("INVOICE", "OLD-", 1501))).ok, true);
    assert.equal(await allocate("INVOICE"), "OLD-1501");
});

test("two kinds of document cannot share a prefix", async () => {
    const result = await saveNumbering(db(), tenantId, userId, only("QUOTE", "old-", 5000));
    assert.equal(result.ok, false);
    assert.ok((result as { errors: Record<string, string[]> }).errors.prefix_QUOTE);
});

test("a bad prefix or number saves nothing at all", async () => {
    const before = await prisma.sequence.findMany({ where: { tenantId }, orderBy: { key: "asc" }, select: { key: true, prefix: true, next: true } });
    const input: NumberingInput = new Map([
        ["CREDIT", { prefix: "CN-", next: 50 }],
        ["RECEIPT", { prefix: "R C", next: 10 }],
    ]);
    const result = await saveNumbering(db(), tenantId, userId, input);
    assert.equal(result.ok, false);
    const afterwards = await prisma.sequence.findMany({ where: { tenantId }, orderBy: { key: "asc" }, select: { key: true, prefix: true, next: true } });
    assert.deepEqual(afterwards, before, "the valid row was saved even though another row was refused");
});

test("every change is in the workshop's audit trail", async () => {
    const trail = await prisma.auditEvent.findMany({ where: { tenantId, entityType: "Sequence" } });
    assert.ok(trail.length >= 3);
});
