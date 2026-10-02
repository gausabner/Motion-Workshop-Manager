import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TENANT_MODELS, UNSCOPED_TENANT_MODELS } from "@/lib/tenant-db";

/**
 * Every model that belongs to a workshop must be known to `forTenant`.
 *
 * This test exists because two were not, and neither omission was visible in
 * development.
 *
 * A model missing from `TENANT_MODELS` is passed straight through the
 * extension: no tenant injected into the query, and — the part that actually
 * breaks — no transaction announcing the tenant to Postgres. Against the
 * superuser connection that development and CI use, row-level security is
 * bypassed unconditionally, so the unscoped query reads across every workshop
 * and every test goes green. Against production, where the app connects
 * NOBYPASSRLS and these tables are FORCE RLS, the same query returns nothing
 * and a create fails with a policy violation.
 *
 * So the two environments fail in opposite directions — a silent cross-tenant
 * read here, a silent empty result there — and neither one tells you. The only
 * way to catch it early is to compare the list against the schema, which is
 * what this does.
 *
 * `Subscription` was found by a 500 while walking the registration flow in a
 * browser. `ExportRun` was found by writing this test, and was live: the
 * accounting hand-off would have failed on its first real run.
 */

function modelsCarryingTenantId(): string[] {
    // Read from the schema rather than from Prisma's generated DMMF, so this
    // fails on an un-regenerated client instead of agreeing with one.
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    const models = schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm);
    const out: string[] = [];
    for (const [, name, body] of models) {
        if (/^\s*tenantId\s+String/m.test(body)) out.push(name);
    }
    return out;
}

test("every model belonging to a workshop is either scoped or a named exemption", () => {
    const carrying = modelsCarryingTenantId();
    assert.ok(carrying.length > 50, `expected to parse the schema, found only ${carrying.length} models with a tenantId`);

    const unaccounted = carrying.filter((m) => !TENANT_MODELS.has(m) && !UNSCOPED_TENANT_MODELS.has(m));
    assert.deepEqual(
        unaccounted,
        [],
        `These models carry a tenantId but forTenant() does not know them: ${unaccounted.join(", ")}.\n` +
            `Queries against them are unscoped — they read across every workshop on a superuser connection, ` +
            `and return nothing or fail outright in production. Add each to TENANT_MODELS, or to ` +
            `UNSCOPED_TENANT_MODELS with a reason if it is one of the tables that establishes identity.`,
    );
});

test("nothing is listed as scoped that no longer belongs to a workshop", () => {
    // The other direction. A model renamed or dropped leaves a name behind that
    // looks like coverage and is not, which is worse than an absence because it
    // reads as though somebody considered it.
    const carrying = new Set(modelsCarryingTenantId());
    const stale = [...TENANT_MODELS, ...UNSCOPED_TENANT_MODELS].filter((m) => !carrying.has(m));
    assert.deepEqual(stale, [], `listed as tenant models but carry no tenantId in the schema: ${stale.join(", ")}`);
});

test("a model is not in both lists", () => {
    const both = [...TENANT_MODELS].filter((m) => UNSCOPED_TENANT_MODELS.has(m));
    assert.deepEqual(both, [], `claimed as both scoped and exempt: ${both.join(", ")}`);
});
