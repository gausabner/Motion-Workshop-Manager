import "server-only";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { resolveShareToken } from "@/lib/sharing/links";
import { getInspection } from "@/lib/inspections/queries";

/**
 * Everything the customer's approval page may see, found by the token alone.
 * The token is resolved to one tenant and one inspection; nothing else is
 * reachable from it.
 */
export async function inspectionForToken(token: string) {
    const share = await resolveShareToken(token);
    if (!share.ok) return { ok: false as const, reason: share.reason };
    if (share.kind !== "INSPECTION") return { ok: false as const, reason: "unknown" as const };
    const tenant = await prisma.tenant.findUnique({ where: { id: share.tenantId } });
    if (!tenant?.isActive) return { ok: false as const, reason: "unknown" as const };
    const db = forTenant(tenant.id);
    const inspection = await getInspection(db, share.targetId);
    if (!inspection) return { ok: false as const, reason: "unknown" as const };
    return { ok: true as const, share, tenant, db, inspection };
}
