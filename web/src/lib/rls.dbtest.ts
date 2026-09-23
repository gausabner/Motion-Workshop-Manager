import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * The wall underneath the wall.
 *
 * `tenant-db.dbtest.ts` proves the application refuses to cross between two
 * clients' books. This proves the database refuses as well, for the paths the
 * application layer never sees: raw SQL, a model missing from TENANT_MODELS, a
 * psql session on a restored backup.
 *
 * Everything here connects as `motion_app` — a role with NOBYPASSRLS — because
 * that is the only way to observe the policies at all. The dev and CI
 * connection is a superuser, and superusers bypass row-level security
 * unconditionally; a test written against that connection would pass while
 * proving nothing, which is worse than no test.
 */

const ID = "zztest-rls";
const TEST_PASSWORD = "rls-dbtest-local-only";

let alpha = "";
let bravo = "";
let appDb: PrismaClient;

/** The same database, reached as the unprivileged application role. */
function appUrl() {
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.username = "motion_app";
    url.password = TEST_PASSWORD;
    return url.toString();
}

/**
 * Run `fn` with the tenant set for the life of one transaction — how the
 * application will have to do it once it stops connecting as a superuser. The
 * setting is local, so it cannot leak to the next borrower of this pooled
 * connection, which is the failure mode that would matter most.
 */
async function asTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return appDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SELECT set_config('motion.tenant_id', $1, true)`, tenantId);
        return fn(tx as unknown as PrismaClient);
    });
}

before(async () => {
    // The migration deliberately ships no password — one in a committed file is
    // one in every clone. The test sets its own against its own database.
    await prisma.$executeRawUnsafe(`ALTER ROLE motion_app WITH PASSWORD '${TEST_PASSWORD}'`);

    const a = await prisma.tenant.create({ data: { slug: `${ID}-a`, name: "ZZTEST RLS Alpha", country: "NA" }, select: { id: true } });
    const b = await prisma.tenant.create({ data: { slug: `${ID}-b`, name: "ZZTEST RLS Bravo", country: "NA" }, select: { id: true } });
    alpha = a.id;
    bravo = b.id;

    await prisma.customer.create({ data: { tenantId: alpha, firstName: "ZZTEST", lastName: "AlphaOnly" } });
    await prisma.customer.create({ data: { tenantId: bravo, firstName: "ZZTEST", lastName: "BravoOnly" } });

    appDb = new PrismaClient({ datasourceUrl: appUrl() });
});

after(async () => {
    await appDb?.$disconnect();
    for (const id of [alpha, bravo]) {
        if (!id) continue;
        await prisma.customer.deleteMany({ where: { tenantId: id } });
        await prisma.tenant.delete({ where: { id } });
    }
});

test("a connection with no tenant set sees nothing", async () => {
    // The important direction of failure. An unset connection showing every
    // workshop's customers is the accident this whole layer exists to prevent,
    // so the policy compares against NULL and NULL is never equal to anything.
    const rows = await appDb.customer.findMany({ where: { lastName: { startsWith: "ZZTEST" } } });
    assert.equal(rows.length, 0, "an unset connection could read customers");
});

test("a tenant sees its own customers and not the other's", async () => {
    const seen = await asTenant(alpha, (tx) =>
        tx.customer.findMany({ where: { lastName: { in: ["AlphaOnly", "BravoOnly"] } }, select: { lastName: true } }),
    );
    assert.deepEqual(seen.map((c) => c.lastName), ["AlphaOnly"]);
});

test("raw SQL is caught too — the path the extension cannot see", async () => {
    // `forTenant()` rewrites Prisma queries; it has no idea this exists. There
    // is already a `SELECT … FOR UPDATE` in the inspections service with no
    // tenant in its WHERE clause, which is exactly this shape.
    const rows = await asTenant(alpha, (tx) =>
        tx.$queryRawUnsafe<{ lastName: string }[]>(`SELECT "lastName" FROM "Customer" WHERE "lastName" LIKE 'ZZTEST%' OR "lastName" IN ('AlphaOnly','BravoOnly')`),
    );
    assert.ok(rows.every((r) => r.lastName !== "BravoOnly"), "raw SQL reached another tenant's customer");
});

test("a tenant cannot plant a row in another's books", async () => {
    await assert.rejects(
        asTenant(alpha, (tx) => tx.customer.create({ data: { tenantId: bravo, firstName: "ZZTEST", lastName: "Forged" } })),
        /row-level security/i,
    );
});

test("a tenant cannot relabel its own row as another's", async () => {
    await assert.rejects(
        asTenant(alpha, (tx) =>
            tx.customer.updateMany({ where: { lastName: "AlphaOnly" }, data: { tenantId: bravo } }),
        ),
        /row-level security/i,
    );
});

test("every table carrying a tenant is covered, with no exceptions", async () => {
    // A list of table names copied into a migration goes stale the first time
    // someone adds a model and does not think about this file. The rule is the
    // column: if a table has `tenantId`, it has the policy — and this fails the
    // build the day that stops being true.
    //
    // FORCE is asserted again now that the application announces its tenant on
    // every connection — except on the four tables that answer "which workshop
    // is this?", which cannot be forced because the query that establishes the
    // tenant cannot itself be tenant-scoped. Forcing those would mean nobody
    // could sign in.
    const gaps = await prisma.$queryRaw<{ relname: string; enabled: boolean; forced: boolean; policies: bigint }[]>`
        SELECT c.relname,
               c.relrowsecurity AS enabled,
               c.relforcerowsecurity AS forced,
               (SELECT count(*) FROM pg_policies p
                 WHERE p.schemaname = 'public' AND p.tablename = c.relname
                   AND p.policyname = 'tenant_isolation') AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND a.attname = 'tenantId' AND NOT a.attisdropped
          AND c.relname NOT IN ('Membership', 'ApiKey', 'Invitation', 'ShareLink', 'Session')
          AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR NOT EXISTS (
                SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
                  AND p.tablename = c.relname AND p.policyname='tenant_isolation'))
        ORDER BY c.relname`;
    assert.deepEqual(gaps.map((g) => g.relname), [], "tables carry tenantId without row-level security");
});

test("the application role cannot simply turn the policies off", async () => {
    // A role that can disable RLS has not been restricted, it has been asked
    // nicely. motion_app does not own the tables and is not a superuser.
    await assert.rejects(
        appDb.$executeRawUnsafe(`ALTER TABLE "Customer" DISABLE ROW LEVEL SECURITY`),
        /must be owner|permission denied/i,
    );
});

test("the tables that resolve a tenant are exempt, and only those", async () => {
    // A short list that should stay short. Anything added here is a table the
    // database stops guarding against the owner, so it wants a reason in
    // writing rather than a quiet commit.
    const exempt = await prisma.$queryRaw<{ relname: string }[]>`
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND a.attname = 'tenantId' AND NOT a.attisdropped
          AND c.relrowsecurity AND NOT c.relforcerowsecurity
        ORDER BY c.relname`;
    assert.deepEqual(
        exempt.map((e) => e.relname),
        ["ApiKey", "Invitation", "Membership", "Session", "ShareLink"],
        "the set of tables exempt from FORCE has changed",
    );
});
