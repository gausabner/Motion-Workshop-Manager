import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { RESERVED_SLUGS, isReservedSlug } from "@/lib/auth/reserved-slugs";

/**
 * The list has to be kept in step with `src/app` by hand. This is what makes
 * that safe.
 *
 * Without it, adding a public page is a silent trap: the next workshop to
 * register with that name gets an account it can never reach, and nothing
 * anywhere reports it — the owner signs in, lands on a 404, and the only way to
 * fix it is to change their URL after they have put it on a business card.
 */

test("every static route is refused as a workshop address", () => {
    const appDir = join(process.cwd(), "src", "app");
    const routes = readdirSync(appDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        // `[tenant]` is the dynamic segment these would shadow, and private
        // folders (`_name`) and route groups (`(name)`) are not URL segments.
        .filter((e) => !e.name.startsWith("[") && !e.name.startsWith("_") && !e.name.startsWith("("))
        .map((e) => e.name);

    assert.ok(routes.length > 5, `expected to find the public routes, found ${routes.length}`);

    const missing = routes.filter((r) => !RESERVED_SLUGS.has(r));
    assert.deepEqual(
        missing,
        [],
        `these routes exist under src/app but a workshop could still register them: ${missing.join(", ")}. Add them to RESERVED_SLUGS.`,
    );
});

test("the check ignores case, because slugs are lowercased and people are not", () => {
    assert.ok(isReservedSlug("Login"));
    assert.ok(isReservedSlug("ACTIVATE"));
});

test("an ordinary workshop name is still available", () => {
    for (const slug of ["tiptop", "windhoek-auto", "oshakati-motors", "activated", "pricing-cars"]) {
        assert.equal(isReservedSlug(slug), false, `${slug} should be allowed`);
    }
});
