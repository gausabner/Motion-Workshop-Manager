/**
 * Addresses a workshop cannot have.
 *
 * Next resolves a static segment before the `[tenant]` one, so a workshop that
 * took one of these names would not break in a dramatic way — it would simply
 * never load. The owner would sign in, land on `/pricing/dashboard`, get a
 * 404, and have no way to find out why. Cheaper to refuse the name at
 * registration than to explain it afterwards, and impossible to fix later
 * without changing somebody's URLs.
 *
 * Its own module rather than a constant in `auth/actions.ts`, because that file
 * carries `"use server"` and may only export async functions — so a list living
 * there could not be read by a test. The test is the point: this has to be kept
 * in step with `src/app` by hand, and a hand-maintained list without a test is
 * a list that is wrong by the third page somebody adds.
 */
export const RESERVED_SLUGS = new Set([
    // Routes that exist.
    "activate",
    "api",
    "approve",
    "forgot",
    "help",
    "join",
    "login",
    "portal",
    "pricing",
    "privacy",
    "register",
    "reset",
    "share",
    "support",
    "terms",
    // Kept back for what comes next, or for the obvious guess at it. "admin" is
    // Phase 2's panel; the rest are names somebody would reasonably try and we
    // would then be unable to use.
    "admin",
    "app",
    "billing",
    "static",
    "www",
    "_next",
]);

export function isReservedSlug(slug: string): boolean {
    return RESERVED_SLUGS.has(slug.toLowerCase());
}
