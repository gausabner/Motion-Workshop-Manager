import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { announceTenant, forTenant } from "@/lib/tenant-db";
import { sequenceAudit, unexplained } from "./gaps";

/**
 * The completeness test, tested.
 *
 * This is the report a council auditor reads first, and the one whose wrong
 * answer is most expensive: saying "every number is accounted for" when one is
 * not would be worse than having no report at all. So the fixture deliberately
 * builds each of the four things that can happen to a number — issued, voided,
 * deleted, and simply missing — and checks that the report tells them apart.
 *
 * Against a real Postgres (`npm run test:db`), because the whole report is a
 * query over documents that exist.
 */

const SLUG = "zztest-gaps";
let tenantId = "";

const FROM = new Date("2026-03-01T00:00:00Z");
const TO = new Date("2026-03-31T23:59:59Z");

/** An invoice on the books, at a number of our choosing. */
async function invoice(number: string, state: "PROCESSED" | "VOID" = "PROCESSED") {
    await prisma.document.create({
        data: {
            tenantId, type: "INVOICE", state, number,
            postDate: new Date("2026-03-10T00:00:00Z"),
            taxName: "VAT", taxRate: 15, total: 100, subtotal: 87, vatTotal: 13,
        },
    });
}

before(async () => {
    const t = await prisma.tenant.create({ data: { slug: SLUG, name: "ZZTEST Gap Motors", country: "NA" }, select: { id: true } });
    tenantId = t.id;

    // 1001, 1002 and 1004 are on the books; 1003 was voided but is still there;
    // 1005 was deleted and recorded; 1006 was never seen again.
    await invoice("INV-1001");
    await invoice("INV-1002");
    await invoice("INV-1003", "VOID");
    await invoice("INV-1004");
    await invoice("INV-1007");

    await prisma.auditEvent.create({
        data: {
            tenantId, entityType: "Document", entityId: "gone-1005", action: "DELETED",
            at: new Date("2026-03-12T09:00:00Z"),
            diff: { reason: "Converted twice by mistake", snapshot: { number: "INV-1005", total: "230.00" } },
        },
    });

    // Three job cards: one finished, one still open on the ramp, and one that
    // is only a booking in the diary. All three hold a number.
    for (const [jobNumber, state] of [["JC-2001", "PROCESSED"], ["JC-2002", "DRAFT"], ["JC-2003", "DRAFT"]] as const) {
        await prisma.document.create({
            data: {
                tenantId, type: state === "PROCESSED" ? "JOB_CARD" : "BOOKING", state, jobNumber,
                postDate: new Date("2026-03-11T00:00:00Z"), taxName: "VAT", taxRate: 15,
            },
        });
    }

    // The counter has handed out two numbers above the highest on the books.
    await prisma.sequence.create({ data: { tenantId, key: "INVOICE", prefix: "INV-", next: 1010 } });
});

after(async () => {
    if (!tenantId) return;
    await prisma.auditEvent.deleteMany({ where: { tenantId } });
    await prisma.sequence.deleteMany({ where: { tenantId } });
    await prisma.documentLine.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
});

const run = () => prisma.$transaction(async (tx) => {
    await announceTenant(tx, tenantId);
    return sequenceAudit(forTenant(tenantId), FROM, TO);
});

test("a voided document is not a gap — it keeps its number", async () => {
    const [invoices] = (await run()).filter((s) => s.key === "INVOICE");
    assert.ok(invoices, "the invoice sequence is reported");
    assert.equal(invoices.gaps.some((g) => g.number === "INV-1003"), false, "1003 was voided, and is still on the books");
    assert.equal(invoices.issued, 5, "all five documents count as issued, void included");
});

test("a deletion accounts for its own gap, and says why", async () => {
    const [invoices] = (await run()).filter((s) => s.key === "INVOICE");
    const gap = invoices.gaps.find((g) => g.number === "INV-1005");
    assert.ok(gap, "1005 is reported as a gap");
    assert.equal(gap.accounted, true, "and it is accounted for");
    assert.match(gap.explanation, /Deleted 2026-03-12/);
    assert.match(gap.explanation, /Converted twice by mistake/, "the reason survives into the report");
});

test("a number nothing explains is the finding", async () => {
    const audits = await run();
    const [invoices] = audits.filter((s) => s.key === "INVOICE");
    const gap = invoices.gaps.find((g) => g.number === "INV-1006");
    assert.ok(gap, "1006 is reported as a gap");
    assert.equal(gap.accounted, false);
    assert.equal(unexplained(audits), 1, "exactly one hole nobody can explain");
});

test("the range and the counts are the ones an auditor re-adds", async () => {
    const [invoices] = (await run()).filter((s) => s.key === "INVOICE");
    assert.equal(invoices.first, "INV-1001");
    assert.equal(invoices.last, "INV-1007");
    assert.equal(invoices.expected, 7, "1001 to 1007 inclusive");
    assert.equal(invoices.issued, 5);
    assert.equal(invoices.gaps.length, 2, "1005 and 1006");
});

test("numbers taken above the last one on the books are reported apart from gaps", async () => {
    const [invoices] = (await run()).filter((s) => s.key === "INVOICE");
    // next is 1010, so 1009 was the last handed out and 1007 the last used.
    assert.equal(invoices.allocatedUnused, 2);
    assert.equal(invoices.gaps.some((g) => g.number === "INV-1008"), false, "a number never used is not a missing document");
});

test("a draft holds its number too — an open job card is not a missing one", async () => {
    // The first version of this report filtered by state, and told a workshop
    // that had lost nothing that twenty job cards were missing. Every booking
    // in the diary is a draft.
    const [jobs] = (await run()).filter((s) => s.key === "JOB");
    assert.ok(jobs, "the job sequence is reported");
    assert.equal(jobs.issued, 3, "the finished one, the open one and the booking");
    assert.deepEqual(jobs.gaps, [], "and none of them is a gap");
});

test("a sequence with nothing in the period is left out rather than reported empty", async () => {
    const audits = await run();
    assert.equal(audits.some((s) => s.key === "SUPPLIER_PAYMENT"), false);
});
