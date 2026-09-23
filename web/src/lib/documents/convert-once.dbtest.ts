import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { forTenant, type TenantDb, type TenantTx } from "@/lib/tenant-db";
import { existingConversion } from "@/lib/documents/convert";

/**
 * A booking converts into one job card, not two.
 *
 * Reported from a live workshop on 23 September: a job card "became
 * duplicates" while being saved and worked on, with the owner and a mechanic
 * both in the system at the same time. The clone carries the source's job
 * number rather than allocating a new one, so two conversions read as one
 * record duplicating itself rather than as two job cards.
 *
 * The second test is the one that matters. A bare "does one exist?" check
 * passes it only by luck: two transactions look, both see nothing, both
 * insert. It fails reliably without the row lock, which is how this bug
 * reached a workshop.
 */

const ID = "zztest-convert-once";
let tenantId = "";
let db: TenantDb;

/**
 * What `cloneInto` does for a linked conversion, reduced to its essentials.
 *
 * `hold` widens the gap between looking and inserting. Without it the two
 * transactions in the concurrency test finish so fast that they never overlap,
 * and the test passes whether or not the lock is there — which makes it worse
 * than no test, because it reports safety that has not been demonstrated. Two
 * people tapping Convert seconds apart on a loaded server is exactly this gap,
 * stretched.
 */
async function convert(sourceId: string, hold = 0): Promise<string> {
    return db.$transaction(async (tx: TenantTx) => {
        const already = await existingConversion(tx, sourceId, "JOB_CARD");
        if (already) return already;
        if (hold) await new Promise((r) => setTimeout(r, hold));
        const made = await tx.document.create({
            data: { tenantId, type: "JOB_CARD", state: "DRAFT", sourceDocumentId: sourceId, jobNumber: "JC-9100" },
            select: { id: true },
        });
        return made.id;
    }, { timeout: 15000 });
}

const booking = async (jobNumber: string) =>
    (await prisma.document.create({
        data: { tenantId, type: "BOOKING", state: "DRAFT", jobNumber },
        select: { id: true },
    })).id;

const jobCardsFrom = (sourceId: string) =>
    prisma.document.count({ where: { sourceDocumentId: sourceId, type: "JOB_CARD", state: { not: "VOID" } } });

before(async () => {
    const t = await prisma.tenant.create({
        data: { slug: ID, name: "ZZTEST Convert Once", country: "NA" },
        select: { id: true },
    });
    tenantId = t.id;
    db = forTenant(tenantId);
});

after(async () => {
    if (tenantId) {
        await prisma.document.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } });
    }
});

test("converting the same booking twice returns the first job card", async () => {
    const source = await booking("JC-9100");
    const first = await convert(source);
    const second = await convert(source);
    assert.equal(second, first, "a second job card was made instead of returning the first");
    assert.equal(await jobCardsFrom(source), 1);
});

test("two people converting at the same moment get one job card between them", async () => {
    const source = await booking("JC-9101");
    // Without the row lock both transactions see an empty table and both
    // insert. This is the shape of what happened in the workshop.
    const [a, b] = await Promise.all([convert(source, 300), convert(source, 300)]);
    assert.equal(await jobCardsFrom(source), 1, "two job cards were created from one booking");
    assert.equal(a, b, "the two callers were given different job cards");
});

test("a voided conversion can be redone", async () => {
    // Voiding is how the workshop cleaned up the duplicates, so it must not
    // leave the booking permanently unconvertible.
    const source = await booking("JC-9102");
    const first = await convert(source);
    await prisma.document.update({ where: { id: first }, data: { state: "VOID" } });
    const second = await convert(source);
    assert.notEqual(second, first, "the voided job card was handed back instead of a new one");
    assert.equal(await jobCardsFrom(source), 1);
});

test("a copy is still allowed to be made twice", async () => {
    // Copies deliberately carry no link to their source, so nothing here
    // should stop someone copying a document as many times as they like.
    const source = await booking("JC-9103");
    for (let i = 0; i < 2; i++) {
        await prisma.document.create({
            data: { tenantId, type: "JOB_CARD", state: "DRAFT", sourceDocumentId: null, jobNumber: `JC-910${4 + i}` },
        });
    }
    assert.equal(await jobCardsFrom(source), 0);
});
