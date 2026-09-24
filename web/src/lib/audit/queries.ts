import type { TenantTx } from "@/lib/tenant-db";

export type AuditRow = {
    id: string;
    at: Date;
    action: string;
    actor: string | null;
    diff: unknown;
};

/**
 * Who did what to one record.
 *
 * MOTION has been writing these in twenty-three places since the beginning and
 * showing them nowhere, which is the least useful place to keep an audit trail.
 * A workshop argument — "this invoice was six thousand yesterday", "who
 * cancelled that job card" — is settled by this list or by nobody.
 *
 * Actor names are resolved here rather than stored on the event, so somebody
 * correcting a typo in their own name does not rewrite history.
 */
export async function listAudit(tx: TenantTx, entityType: string, entityId: string, take = 50): Promise<AuditRow[]> {
    const rows = await tx.auditEvent.findMany({
        where: { entityType, entityId },
        orderBy: { at: "desc" },
        take,
        select: { id: true, at: true, action: true, diff: true, actorUserId: true },
    });
    if (rows.length === 0) return [];

    const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => !!id))];
    // Users are not tenant-scoped, so this is a plain lookup rather than
    // something the tenant client can join through.
    const people = actorIds.length
        ? await tx.membership.findMany({
              where: { userId: { in: actorIds } },
              select: { userId: true, user: { select: { firstName: true, lastName: true } } },
          })
        : [];
    const byId = new Map(people.map((m) => [m.userId, `${m.user.firstName} ${m.user.lastName}`.trim()]));

    return rows.map((r) => ({
        id: r.id,
        at: r.at,
        action: r.action,
        actor: r.actorUserId ? (byId.get(r.actorUserId) ?? null) : null,
        diff: r.diff,
    }));
}
