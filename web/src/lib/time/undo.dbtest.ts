import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { clockOff, clockOn, undoLast } from "@/lib/time/clocking";

/**
 * Undo on the floor: a Stop reopens the entry it closed, a Switch removes the
 * entry it started and reopens the one it stopped, and neither can be taken
 * back once it is a minute old or something else has happened.
 */

const SLUG = "zztest-undo";
let tenant: Tenant;
let mechanic = "";
const job = { a: "", b: "" };
const db = () => forTenant(tenant.id);
type Tx = Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0];
const run = <T,>(fn: (tx: Tx) => Promise<T>) => db().$transaction(fn) as Promise<T>;
const entries = () => prisma.timeEntry.findMany({ where: { mechanicId: mechanic }, orderBy: { startedAt: "asc" }, select: { documentId: true, endedAt: true, minutes: true } });
const at = (minute: number, second = 0) => new Date(Date.UTC(2026, 10, 25, 8, minute, second));

before(async () => {
    tenant = await prisma.tenant.create({ data: { status: "ACTIVE", slug: SLUG, name: "ZZTEST Undo Workshop", country: "NA" } });
    const user = await prisma.user.create({ data: { email: `${SLUG}@example.invalid`, passwordHash: "x", firstName: "Tobias", lastName: "ZZTEST" }, select: { id: true } });
    mechanic = (await prisma.membership.create({ data: { tenantId: tenant.id, userId: user.id, group: "MECHANIC", status: "ACTIVE", isMechanic: true }, select: { id: true } })).id;
    const card = (n: string) => prisma.document.create({ data: { tenantId: tenant.id, type: "JOB_CARD", jobNumber: n, jobStatus: "WORK_IN_PROGRESS" }, select: { id: true } }).then((d) => d.id);
    job.a = await card("JC-9201");
    job.b = await card("JC-9202");
});

after(async () => {
    const tenantId = tenant.id;
    await prisma.timeEntry.deleteMany({ where: { tenantId } });
    await prisma.documentStatusEvent.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await prisma.membership.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { slug: SLUG } });
    await prisma.user.deleteMany({ where: { email: { startsWith: SLUG } } });
});

test("undoing a Stop opens the same entry again", async () => {
    await run((tx) => clockOn(tx, tenant.id, mechanic, job.a, at(0)));
    await run((tx) => clockOff(tx, mechanic, at(30)));
    await run((tx) => undoLast(tx, mechanic, at(30, 8)));
    assert.deepEqual(await entries(), [{ documentId: job.a, endedAt: null, minutes: null }], "one entry, running again; no gap and no second entry");
});

test("undoing a Switch puts the clock back on the first job", async () => {
    await run((tx) => clockOn(tx, tenant.id, mechanic, job.b, at(40)));
    assert.equal((await entries()).length, 2);
    await run((tx) => undoLast(tx, mechanic, at(40, 5)));
    assert.deepEqual(await entries(), [{ documentId: job.a, endedAt: null, minutes: null }], "the switch is gone and the first job runs on");
});

test("nothing old, and nothing that is not a Stop or a Switch, can be undone", async () => {
    await run((tx) => clockOff(tx, mechanic, at(50)));
    await assert.rejects(run((tx) => undoLast(tx, mechanic, at(52))), /too long ago/);
    await run((tx) => clockOn(tx, tenant.id, mechanic, job.b, at(55)));
    await assert.rejects(run((tx) => undoLast(tx, mechanic, at(55, 10))), /nothing to undo/, "a plain Start, after a stop, is not a switch");
});
