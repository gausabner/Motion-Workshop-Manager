import "server-only";

import type { TenantDb } from "@/lib/tenant-db";
import { asPlanId, type PlanId } from "@/lib/plans/features";

/**
 * The plan a workshop pays for, read from its subscription — or null when it
 * has none yet (switched on before plans existed), which keeps everything.
 * One reading, used by every door: the dashboard, the API and the nightly
 * hand-off.
 */
export async function planFor(db: TenantDb, tenantId: string): Promise<PlanId | null> {
    const subscription = await db.subscription.findUnique({ where: { tenantId }, select: { planId: true, status: true } });
    return subscription && subscription.status !== "CANCELLED" ? asPlanId(subscription.planId) : null;
}
