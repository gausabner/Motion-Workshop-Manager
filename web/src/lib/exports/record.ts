import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Taking a file out of MOTION is itself an act, and is recorded like one.
 *
 * A council asks how the system knows a customer list was not walked out of
 * the building on somebody's last Friday. "It does not" is the wrong answer,
 * and it is the answer every product in this market currently gives.
 *
 * What is written is who, what report, over what period, in what format, and
 * how many rows — never the rows themselves. An audit trail that copies the
 * data it is auditing doubles the thing you were worried about leaking.
 */
export async function recordExport(
    db: TenantDb,
    tenantId: string,
    actorUserId: string,
    detail: { report: string; format: "csv" | "pdf"; from?: Date; to?: Date; rows: number },
): Promise<void> {
    await db.auditEvent.create({
        data: {
            tenantId,
            actorUserId,
            entityType: "Export",
            // The report is the entity: "who has been pulling the debtors list"
            // is a question somebody asks, and it wants an answer that groups.
            entityId: detail.report,
            action: "EXPORTED",
            diff: {
                report: detail.report,
                format: detail.format,
                rows: detail.rows,
                ...(detail.from ? { from: detail.from.toISOString().slice(0, 10) } : {}),
                ...(detail.to ? { to: detail.to.toISOString().slice(0, 10) } : {}),
            },
        },
    });
}
