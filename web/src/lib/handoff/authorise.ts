import { timingSafeEqual } from "node:crypto";

/**
 * Whether a caller may trigger the unattended export.
 *
 * Extracted from the route so the one property that really matters can be
 * tested: an unset secret means the endpoint is **off**, not open. That is the
 * failure that would not announce itself — every other mistake here produces a
 * 401 somebody notices, while a default-open endpoint looks exactly like a
 * working one until the day it is found.
 *
 * The comparison is constant-time. This endpoint answers from wherever the app
 * is reachable, and `a === b` on a secret leaks it a character at a time to
 * anybody willing to measure.
 */

/** Long enough that guessing is not a strategy; short enough that nobody works around it. */
export const MIN_SECRET_LENGTH = 16;

export function authorised(offeredHeader: string | null, secret: string | undefined): boolean {
    const expected = secret?.trim() ?? "";
    if (expected.length < MIN_SECRET_LENGTH) return false;

    const header = offeredHeader ?? "";
    if (!header.startsWith("Bearer ")) return false;
    const offered = header.slice(7).trim();

    const a = Buffer.from(offered);
    const b = Buffer.from(expected);
    // Lengths are compared first because timingSafeEqual throws on a mismatch,
    // and a thrown exception is itself a signal about the secret's length.
    return a.length === b.length && timingSafeEqual(a, b);
}
