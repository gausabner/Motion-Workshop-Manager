import "server-only";
import type { ApiCaller } from "./auth";
import type { TenantTx } from "@/lib/tenant-db";

/**
 * An integration's own identifiers, kept in `ExternalRef` rather than as
 * columns on the records themselves.
 *
 * This is the point of that table. Their invoice carries ~40 sync columns —
 * `qbo_id`, `xero_sync_status`, `needs_myob_sync`, `needs_carfax_sync` … — one
 * set per partner, widening a core table every time somebody integrates.
 * Ours widen a side table instead, and the core stays the shape of the
 * business.
 *
 * It is also what makes a write safe to retry: a website that posts a booking,
 * times out and posts again sends the same `externalId` and gets the same
 * record back, rather than booking the car in twice.
 */

/** Records created through the public API all share one provider; a caller's own ids are unique within it. */
const PROVIDER = "api";

export type ApiEntity = "customer" | "vehicle" | "booking";

export async function lookupByExternalId(caller: ApiCaller, entityType: ApiEntity, externalId: string): Promise<string | null> {
    const ref = await caller.db.externalRef.findFirst({
        where: { provider: PROVIDER, entityType, externalId },
        select: { entityId: true },
    });
    return ref?.entityId ?? null;
}

export async function linkExternalId(tx: TenantTx, tenantId: string, entityType: ApiEntity, entityId: string, externalId: string): Promise<void> {
    await tx.externalRef.create({ data: { tenantId, provider: PROVIDER, entityType, entityId, externalId } });
}

/**
 * Create the record and claim the caller's identifier together, or do neither.
 *
 * Two requests carrying the same `externalId` can still arrive at once, and
 * the second loses the unique index. Inside a transaction a failed statement
 * aborts everything after it, so that clash cannot be caught and smoothed over
 * — which is what we want here: the losing request writes nothing at all,
 * rather than leaving a customer behind with no identifier attached to them.
 */
export async function createLinked<T>(
    caller: ApiCaller,
    entityType: ApiEntity,
    externalId: string | undefined,
    create: (tx: TenantTx) => Promise<T & { id: string }>,
): Promise<T & { id: string }> {
    return caller.db.$transaction(async (tx) => {
        const created = await create(tx);
        if (externalId) await linkExternalId(tx, caller.tenant.id, entityType, created.id, externalId);
        return created;
    });
}
