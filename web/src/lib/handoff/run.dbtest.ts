import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { resetDriversForTest } from "@/lib/storage";
import { runJournalHandoff, missingDays } from "./run";
import { collectReceipts, RECEIPT_SUFFIX } from "./receipts";

/**
 * The unattended job, tested against a real database and a real folder.
 *
 * Everything here is about what happens when nobody is watching, because that
 * is the only time this code runs. The three failures worth building for:
 * the schedule firing twice and posting the day twice, a journal that does not
 * balance getting out of the building, and a folder nobody reads looking
 * exactly like a folder that works.
 */

const SLUG = "zztest-handoff";
let tenantId = "";
let root = "";

const DAY = "2026-03-10";

async function invoice(number: string, net: number, tax: number, on = DAY) {
    await prisma.document.create({
        data: {
            tenantId, type: "INVOICE", state: "PROCESSED", number,
            postDate: new Date(`${on}T00:00:00Z`),
            taxName: "VAT", taxRate: 15, subtotal: net, vatTotal: tax, total: net + tax,
        },
    });
}

const tenantRow = () => prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });

before(async () => {
    root = mkdtempSync(join(tmpdir(), "motion-handoff-"));
    process.env.STORAGE_DRIVER = "local";
    process.env.STORAGE_LOCAL_ROOT = root;
    resetDriversForTest();

    const t = await prisma.tenant.create({
        data: {
            slug: SLUG, name: "ZZTEST Handoff Motors", country: "NA", timezone: "Africa/Windhoek", currency: "NAD",
            settings: {
                handoff: { enabled: true, shape: "motion", folder: "drop/{tenant}/{yyyy}", receiptFolder: "drop/{tenant}/receipts", keepYears: 7 },
                accounting: { debtors: "610", sales: "200", tax: "820", bank: "090", creditors: "800", purchases: "300", inputTax: "825" },
            },
        },
        select: { id: true },
    });
    tenantId = t.id;
});

beforeEach(async () => {
    await prisma.exportRun.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
});

after(async () => {
    await prisma.exportRun.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
});

test("a day's trade is written into the drop folder, and the run records what went", async () => {
    const db = forTenant(tenantId);
    await invoice("INV-1", 1000, 150);

    const out = await runJournalHandoff(db, await tenantRow(), { day: DAY, triggeredBy: "schedule" });
    assert.equal(out.state, "DELIVERED");
    assert.equal(out.rows, 3, "debtors, sales and tax");
    assert.equal(out.key, "drop/zztest-handoff/2026/zztest-handoff-journal-2026-03-10.csv");
    assert.ok(existsSync(join(root, out.key!)), "the file is actually on disk");
    assert.match(out.checksum!, /^[0-9a-f]{64}$/);

    const run = await db.exportRun.findFirstOrThrow({ where: { kind: "JOURNAL" } });
    assert.equal(run.state, "DELIVERED");
    assert.equal(run.bytes, out.bytes);
    assert.equal(run.triggeredBy, "schedule");
});

test("a schedule that fires twice does not send the day twice", async () => {
    const db = forTenant(tenantId);
    await invoice("INV-1", 1000, 150);
    const tenant = await tenantRow();

    const first = await runJournalHandoff(db, tenant, { day: DAY, triggeredBy: "schedule" });
    const second = await runJournalHandoff(db, tenant, { day: DAY, triggeredBy: "schedule" });

    assert.equal(first.state, "DELIVERED");
    assert.equal(second.state, "SKIPPED");
    assert.equal(second.alreadyDone, true);
    assert.equal(second.runId, first.runId, "the same run, not a second one");
    assert.equal(await db.exportRun.count({ where: { kind: "JOURNAL" } }), 1);
});

test("asking again with force sends it again, because that is a separate decision", async () => {
    const db = forTenant(tenantId);
    await invoice("INV-1", 1000, 150);
    const tenant = await tenantRow();

    await runJournalHandoff(db, tenant, { day: DAY, triggeredBy: "schedule" });
    const again = await runJournalHandoff(db, tenant, { day: DAY, triggeredBy: "Courtney", force: true });

    assert.equal(again.state, "DELIVERED");
    assert.equal(await db.exportRun.count({ where: { kind: "JOURNAL" } }), 1, "still one run for the day");
    const run = await db.exportRun.findFirstOrThrow({ where: { kind: "JOURNAL" } });
    assert.equal(run.triggeredBy, "Courtney", "and it now records who resent it");
});

test("a day with no trade is a successful run that writes nothing", async () => {
    const db = forTenant(tenantId);
    const out = await runJournalHandoff(db, await tenantRow(), { day: DAY, triggeredBy: "schedule" });

    assert.equal(out.state, "DELIVERED");
    assert.equal(out.rows, 0);
    assert.equal(out.key, undefined, "no file, rather than a file of headers");

    // The distinction that matters: a quiet Sunday is recorded as done, so it
    // does not show up later as a day the schedule missed.
    const missing = await missingDays(db, new Date(`${DAY}T00:00:00Z`), new Date(`${DAY}T00:00:00Z`), "motion");
    assert.deepEqual(missing, []);
});

test("a day the schedule never covered is reported missing, unlike a quiet one", async () => {
    const db = forTenant(tenantId);
    await runJournalHandoff(db, await tenantRow(), { day: "2026-03-10", triggeredBy: "schedule" });

    const missing = await missingDays(db, new Date("2026-03-09T00:00:00Z"), new Date("2026-03-11T00:00:00Z"), "motion");
    assert.deepEqual(missing, ["2026-03-09", "2026-03-11"]);
});

test("a receipt from the other end turns a sent file into a confirmed one", async () => {
    const db = forTenant(tenantId);
    await invoice("INV-1", 1000, 150);
    const tenant = await tenantRow();
    const out = await runJournalHandoff(db, tenant, { day: DAY, triggeredBy: "schedule" });

    const before = await collectReceipts(db, tenant);
    assert.equal(before.acknowledged, 0, "nothing has taken it yet");

    // What the ERP end does: one file, named the same, with .ok on it.
    const receiptDir = join(root, "drop/zztest-handoff/receipts");
    mkdirSync(receiptDir, { recursive: true });
    writeFileSync(join(receiptDir, `${out.fileName}${RECEIPT_SUFFIX}`), "imported\n");

    const after = await collectReceipts(db, tenant);
    assert.equal(after.acknowledged, 1);
    const run = await db.exportRun.findFirstOrThrow({ where: { kind: "JOURNAL" } });
    assert.equal(run.state, "ACKNOWLEDGED");
    assert.ok(run.acknowledgedAt);
});

test("with no receipt folder agreed, nothing is ever marked confirmed", async () => {
    const db = forTenant(tenantId);
    await invoice("INV-1", 1000, 150);
    await runJournalHandoff(db, await tenantRow(), { day: DAY, triggeredBy: "schedule" });

    const quiet = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const settings = quiet.settings as Record<string, unknown>;
    const withoutReceipts = {
        ...quiet,
        settings: { ...settings, handoff: { ...(settings.handoff as object), receiptFolder: "" } },
    };

    const result = await collectReceipts(db, withoutReceipts);
    assert.deepEqual(result, { checked: 0, acknowledged: 0 });
    const run = await db.exportRun.findFirstOrThrow({ where: { kind: "JOURNAL" } });
    assert.equal(run.state, "DELIVERED", "sent, and honestly not confirmed");
});

test("what actually lands on disk balances, read back from the file", async () => {
    const db = forTenant(tenantId);
    // A day with all four kinds of movement on it, and amounts that do not
    // divide evenly, which is where a rounding mistake would show.
    await invoice("INV-1", 333.33, 50.0);
    await invoice("INV-2", 666.67, 100.0);
    await prisma.document.create({
        data: {
            tenantId, type: "CREDIT", state: "PROCESSED", number: "CR-1",
            postDate: new Date(`${DAY}T00:00:00Z`),
            taxName: "VAT", taxRate: 15, subtotal: -100, vatTotal: -15, total: -115,
        },
    });

    const out = await runJournalHandoff(db, await tenantRow(), { day: DAY, triggeredBy: "schedule" });
    assert.equal(out.state, "DELIVERED");

    // The guard inside the runner refuses an unbalanced journal, but a guard
    // that is never exercised proves nothing. This reads the bytes that were
    // actually written and adds them up, which is what the receiving system
    // will do.
    const csv = readFileSync(join(root, out.key!), "utf8");
    const rows = csv.trim().split("\r\n").slice(1).map((line) => line.split(","));
    const debits = rows.reduce((total, r) => total + Number(r[4] || 0), 0);
    const credits = rows.reduce((total, r) => total + Number(r[5] || 0), 0);
    assert.equal(Math.round(debits * 100), Math.round(credits * 100), csv);
    assert.ok(debits > 0, "and it is not balanced by being empty");
});

test("a drop folder that cannot be written is a failed run with the reason on it, not a silent one", async () => {
    const db = forTenant(tenantId);
    await invoice("INV-1", 1000, 150);

    const tenant = await tenantRow();
    const settings = tenant.settings as Record<string, unknown>;
    const unwritable = {
        ...tenant,
        // A path the local driver cannot create under its root.
        settings: { ...settings, handoff: { ...(settings.handoff as object), folder: "\0bad" } },
    };

    const out = await runJournalHandoff(db, unwritable, { day: DAY, triggeredBy: "schedule" });
    assert.equal(out.state, "FAILED");
    assert.ok(out.error && out.error.length > 0);

    const run = await db.exportRun.findFirstOrThrow({ where: { kind: "JOURNAL" } });
    assert.equal(run.state, "FAILED");
    assert.ok(run.error, "and the reason is kept, so the screen can say what went wrong");
});
