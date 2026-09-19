import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { parseSettings } from "@/lib/settings/schema";
import type { SetupFacts } from "@/lib/setup/checklist";

export async function setupFacts(db: TenantDb, tenant: Tenant): Promise<SetupFacts> {
    const settings = parseSettings(tenant.settings);
    const [taxSaves, mechanics, customers, jobs] = await Promise.all([
        db.auditEvent.count({ where: { entityType: "Tenant", entityId: tenant.id, action: "UPDATED", diff: { path: ["section"], equals: "tax" } } }),
        db.membership.count({ where: { status: "ACTIVE", isMechanic: true } }),
        db.customer.count({ where: { archivedAt: null } }),
        db.document.count({ where: { type: "JOB_CARD" } }),
    ]);
    return {
        hasAddress: Boolean(tenant.address1 && tenant.city),
        hasContact: Boolean(tenant.phone || tenant.mobile || tenant.email),
        taxReviewed: taxSaves > 0,
        hasVatNumber: Boolean(tenant.vatNumber),
        hasLogo: Boolean(settings.logoAttachmentId),
        hasBankDetails: Boolean(settings.bankDetails),
        hoursSet: settings.diary !== undefined,
        mechanics,
        customers,
        jobs,
        onlineBooking: settings.diary?.onlineBooking === true,
    };
}
