import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ApiScope } from "@prisma/client";

/**
 * Keys for the public API.
 *
 * The key *is* the tenant: an integrator sends `Authorization: Bearer mk_live_…`
 * and nothing else, so no slug appears in a path and no session cookie is
 * involved. That means the secret is the only thing between an outsider and a
 * workshop's books, so it follows the share-link rules — 32 random bytes, only
 * the hash stored, revocable, and shown to the person exactly once.
 *
 * The readable head ("mk_live_7Qa3") is stored in the clear so a workshop can
 * tell two keys apart in the list without either being recoverable.
 */

export const KEY_PREFIX = "mk_live_";
const BODY_BYTES = 24;

export function mintApiKey(): { token: string; prefix: string; tokenHash: string } {
    const token = `${KEY_PREFIX}${randomBytes(BODY_BYTES).toString("base64url")}`;
    return { token, prefix: keyPrefix(token), tokenHash: hashApiKey(token) };
}

export function hashApiKey(token: string): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is not set (see .env.example)");
    return createHash("sha256").update(`apikey.${token}.${secret}`).digest("hex");
}

/** What the workshop sees in its list: enough to recognise, not enough to use. */
export function keyPrefix(token: string): string {
    return token.slice(0, KEY_PREFIX.length + 4);
}

/**
 * Pull the key out of an Authorization header. Anything that is not a bearer
 * token of our own shape is rejected here rather than becoming a database
 * lookup, because an endpoint reachable without a session is worth keeping
 * cheap to say no to.
 */
export function bearerToken(header: string | null): string | null {
    if (!header) return null;
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    const token = match?.[1];
    if (!token || !token.startsWith(KEY_PREFIX)) return null;
    if (token.length < KEY_PREFIX.length + 16 || token.length > 200) return null;
    return token;
}

/** Constant-time compare, for the one place a stored hash meets a presented one. */
export function hashesMatch(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}

export function hasScope(scopes: ApiScope[], needed: ApiScope): boolean {
    return scopes.includes(needed);
}

/**
 * A fixed window, counted on the key's own row so every instance shares one
 * count. Generous enough that an honest nightly sync never notices it, low
 * enough that a runaway loop is stopped before it reads the whole ledger.
 */
export const RATE_LIMIT = { requests: 120, windowSeconds: 60 } as const;

export function windowHasRolled(windowStart: Date, now: Date): boolean {
    return now.getTime() - windowStart.getTime() >= RATE_LIMIT.windowSeconds * 1000;
}

/** Seconds until the caller may try again — what goes in `Retry-After`. */
export function retryAfter(windowStart: Date, now: Date): number {
    const elapsed = (now.getTime() - windowStart.getTime()) / 1000;
    return Math.max(1, Math.ceil(RATE_LIMIT.windowSeconds - elapsed));
}
