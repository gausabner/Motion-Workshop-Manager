import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { quoteOutcomes } from "./quotes";

/**
 * What happened to the quotes, tested.
 *
 * The rule worth testing is the one that is a judgement rather than a fact:
 * a quote MOTION did not convert is called lost once its follow-up date has
 * passed, and open until then. The first version of this compared that date
 * against the end of the reporting period instead of against today, which
 * meant asking for "this year" — a period ending in December — declared every
 * live quote on the books lost. The figures were not slightly off; the
 * headline number was backwards.
 *
 * Against a real Postgres (`npm run test:db`), because the whole thing is a
 * query over documents and the conversion is read from a relation.
 */

const SLUG = "zztest-quotes";
let tenantId = "";

const FROM = new Date("2026-03-01T00:00:00Z");
const TO = new Date("2026-03-31T23:59:59.999Z");
/** Pretend it is the middle of the following month whenever "now" matters. */
const NOW = new Date("2026-04-15T09:00:00Z");

async function quote(number: string, opts: { on?: string; followUp?: string | null; total?: number; state?: "DRAFT" | "PROCESSED" | "VOID" } = {}) {
    return prisma.document.create({
        data: {
            tenantId, type: "QUOTE", state: opts.state ?? "PROCESSED", number,
            postDate: new Date(`${opts.on ?? "2026-03-10"}T00:00:00Z`),
            followUpDate: opts.followUp === undefined ? null : opts.followUp === null ? null : new Date(`${opts.followUp}T00:00:00Z`),
            taxName: "VAT", taxRate: 15, total: opts.total ?? 1000, subtotal: 870, vatTotal: 130,
        },
        select: { id: true },
    });
}

before(async () => {
    const t = await prisma.tenant.create({ data: { slug: SLUG, name: "ZZTEST Quote Motors", country: "NA" }, select: { id: true } });
    tenantId = t.id;
});

after(async () => {
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.$disconnect();
});

test("a quote is open or lost as at today, not as at the end of the period asked for", async () => {
    const db = forTenant(tenantId);
    // Raised on the 10th with a follow-up on the 20th of the same month. As at
    // the middle of April that date has passed, so it is lost.
    await quote("Q-100", { on: "2026-03-10", followUp: "2026-03-20" });
    // Raised on the 30th, followed up in May — still live in the middle of April.
    await quote("Q-101", { on: "2026-03-30", followUp: "2026-05-30" });

    const asAtApril = await quoteOutcomes(db, FROM, TO, NOW);
    assert.equal(asAtApril.counts.Lost, 1, "the one whose follow-up has passed");
    assert.equal(asAtApril.counts.Open, 1, "the one still inside its window");

    // The bug: judged against the period end, both would read as decided,
    // because the period ends after neither follow-up date has passed.
    const asAtMarch11 = await quoteOutcomes(db, FROM, TO, new Date("2026-03-11T00:00:00Z"));
    assert.equal(asAtMarch11.counts.Open, 2, "on the 11th, neither has been followed up yet");
    assert.equal(asAtMarch11.counts.Lost, 0);
});

test("a quote that became a job is won, however long the customer took to say yes", async () => {
    const db = forTenant(tenantId);
    await prisma.document.deleteMany({ where: { tenantId } });

    const q = await quote("Q-200", { on: "2026-03-02", followUp: "2026-03-05", total: 4000 });
    await prisma.document.create({
        data: {
            tenantId, type: "JOB_CARD", state: "DRAFT", jobNumber: "JC-900",
            postDate: new Date("2026-03-09T00:00:00Z"), sourceDocumentId: q.id,
            taxName: "VAT", taxRate: 15, total: 4000,
        },
    });

    const out = await quoteOutcomes(db, FROM, TO, NOW);
    assert.equal(out.counts.Won, 1);
    // Its follow-up date is long past, and it is still won rather than lost:
    // what the workshop did outranks what the calendar says.
    assert.equal(out.counts.Lost, 0);
    assert.equal(out.rows[0].daysToWin, 7);
    assert.equal(out.rows[0].becameNumber, "JC-900");
});

test("a cancelled quote is left out of the rate, so tidying up does not look like losing", async () => {
    const db = forTenant(tenantId);
    await prisma.document.deleteMany({ where: { tenantId } });

    const won = await quote("Q-300", { total: 1000 });
    await prisma.document.create({
        data: {
            tenantId, type: "INVOICE", state: "PROCESSED", number: "INV-900",
            postDate: new Date("2026-03-12T00:00:00Z"), sourceDocumentId: won.id,
            taxName: "VAT", taxRate: 15, total: 1000,
        },
    });
    await quote("Q-301", { on: "2026-03-01", followUp: "2026-03-02", total: 1000 });
    await quote("Q-302", { total: 5000, state: "VOID" });

    const out = await quoteOutcomes(db, FROM, TO, NOW);
    assert.equal(out.counts.Won, 1);
    assert.equal(out.counts.Lost, 1);
    assert.equal(out.counts.Cancelled, 1);
    // One won and one lost out of two decided, and the 5000 cancelled does not
    // drag it to a third.
    assert.equal(out.conversionByCount, 50);
    assert.equal(out.conversionByValue, 50);
});

test("a void quote is not counted as won even when something was raised from it", async () => {
    const db = forTenant(tenantId);
    await prisma.document.deleteMany({ where: { tenantId } });

    const q = await quote("Q-400", { state: "VOID" });
    await prisma.document.create({
        data: {
            tenantId, type: "INVOICE", state: "VOID", number: "INV-901",
            postDate: new Date("2026-03-12T00:00:00Z"), sourceDocumentId: q.id,
            taxName: "VAT", taxRate: 15, total: 1000,
        },
    });

    const out = await quoteOutcomes(db, FROM, TO, NOW);
    assert.equal(out.counts.Cancelled, 1);
    assert.equal(out.counts.Won, 0, "a voided invoice is not work won");
});
