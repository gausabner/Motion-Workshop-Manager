import "server-only";
import { Prisma, type ApiScope, type Tenant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant, type TenantDb } from "@/lib/tenant-db";
import { bearerToken, hashApiKey, hasScope, RATE_LIMIT, retryAfter } from "./keys";
import { fail } from "./http";

export type ApiCaller = { db: TenantDb; tenant: Tenant; keyId: string; scopes: ApiScope[] };

/**
 * Every public endpoint starts here. It resolves the bearer key to a tenant,
 * charges the request against that key's rate limit, and hands back a database
 * already scoped to the tenant — the same `forTenant` extension the dashboard
 * uses, so a public route cannot read wider than a logged-in page could.
 */
export async function authenticate(req: Request, needed: ApiScope): Promise<ApiCaller | Response> {
    const token = bearerToken(req.headers.get("authorization"));
    if (!token) return fail("unauthorized", "Send your key as `Authorization: Bearer mk_live_…`.");

    // The hash is unique, so this is a single indexed lookup and reveals nothing on a miss.
    const key = await prisma.apiKey.findUnique({
        where: { tokenHash: hashApiKey(token) },
        select: { id: true, tenantId: true, scopes: true, revokedAt: true },
    });
    if (!key || key.revokedAt) return fail("unauthorized", "That key is not valid.");
    if (!hasScope(key.scopes, needed)) {
        return fail("forbidden", needed === "WRITE" ? "This key may only read." : "This key may not read that.");
    }

    const limit = await charge(key.id);
    if (!limit.ok) {
        return fail("rate_limited", `More than ${RATE_LIMIT.requests} requests in a minute. Try again shortly.`, {
            headers: { "retry-after": String(limit.retryAfter) },
        });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: key.tenantId } });
    if (!tenant) return fail("unauthorized", "That key is not valid.");
    return { db: forTenant(tenant.id), tenant, keyId: key.id, scopes: key.scopes };
}

/**
 * One statement, so two requests arriving together cannot both read the old
 * count and both decide they are under the limit. Postgres locks the row for
 * the update; the value returned is the one this request was actually given.
 */
async function charge(keyId: string): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
    const now = new Date();
    const windowFloor = new Date(now.getTime() - RATE_LIMIT.windowSeconds * 1000);
    const [row] = await prisma.$queryRaw<{ windowCount: number; windowStart: Date }[]>`
        UPDATE "ApiKey"
        SET "windowStart"  = CASE WHEN "windowStart" <= ${windowFloor} THEN ${now} ELSE "windowStart" END,
            "windowCount"  = CASE WHEN "windowStart" <= ${windowFloor} THEN 1 ELSE "windowCount" + 1 END,
            "lastUsedAt"   = ${now}
        WHERE "id" = ${keyId}
        RETURNING "windowCount", "windowStart"`;
    if (!row) return { ok: false, retryAfter: RATE_LIMIT.windowSeconds };
    if (row.windowCount > RATE_LIMIT.requests) return { ok: false, retryAfter: retryAfter(row.windowStart, now) };
    return { ok: true };
}

/** Route handlers read like their dashboard counterparts: authenticate, then answer. */
export function withKey(needed: ApiScope, handler: (caller: ApiCaller, req: Request) => Promise<Response>) {
    return async (req: Request): Promise<Response> => {
        const caller = await authenticate(req, needed);
        if (caller instanceof Response) return caller;
        try {
            return await handler(caller, req);
        } catch (error) {
            // Two requests carrying the same externalId: the loser wrote nothing, and should be told why rather than shown a 500.
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                return fail("conflict", "That `externalId` is already used by another record. Nothing was created.", { field: "externalId" });
            }
            console.error("public api", error);
            return fail("server_error", "Something went wrong at our end.");
        }
    };
}
