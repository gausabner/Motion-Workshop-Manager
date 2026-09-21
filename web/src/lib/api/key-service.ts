import "server-only";
import type { ApiScope } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { mintApiKey } from "./keys";

/** The list a workshop sees: enough to recognise a key and decide to revoke it. Never the key. */
export async function listKeys(db: TenantDb) {
    return db.apiKey.findMany({
        orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
        select: {
            id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, revokedAt: true, createdAt: true,
            createdBy: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
    });
}

export type KeyRow = Awaited<ReturnType<typeof listKeys>>[number];

/**
 * The secret is returned here and never again — it is not stored, only its
 * hash is, so nobody at MOTION can recover it either. A workshop that loses a
 * key revokes it and makes another.
 */
export async function createKey(
    db: TenantDb,
    tenantId: string,
    input: { name: string; scopes: ApiScope[]; membershipId: string },
): Promise<{ id: string; token: string }> {
    const minted = mintApiKey();
    const row = await db.apiKey.create({
        data: {
            tenantId,
            name: input.name,
            prefix: minted.prefix,
            tokenHash: minted.tokenHash,
            scopes: input.scopes,
            createdById: input.membershipId,
        },
        select: { id: true },
    });
    return { id: row.id, token: minted.token };
}

/**
 * Revoking keeps the row. A key that was used to pull a year of invoices is
 * part of the record of who saw what, so it is marked dead rather than erased.
 */
export async function revokeKey(db: TenantDb, id: string): Promise<void> {
    await db.apiKey.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
}
