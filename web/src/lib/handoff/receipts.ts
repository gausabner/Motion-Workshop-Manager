import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { driverNamed, storage } from "@/lib/storage";
import { handoffSettings } from "@/lib/settings/schema";
import { destinationKey, resolveFolder } from "@/lib/handoff/destination";

/**
 * The other direction: did the receiving system actually take the file?
 *
 * This is the leg that looks optional and is not. Without it, a drop folder
 * that silently stopped being read — a mount that came back read-only, a
 * scheduled import somebody disabled while debugging something else, an ERP
 * upgrade that moved the watch folder — produces exactly the same evidence as
 * a working integration: MOTION writes files, and they are there. The first
 * anyone learns is at year end, when a month of journals is missing from the
 * books and everybody's recollection of March is gone.
 *
 * The contract is the smallest one an ERP-side script can honour: when the
 * import succeeds, drop a file of the same name with `.ok` after it into the
 * receipt folder. Not a message, not a callback, not a port — a file, because
 * the site that will not let us listen on anything will let a scheduled task
 * write a file. Anyone can implement that end in a line of shell.
 *
 * Its contents are never read, only its existence. Parsing a receipt would
 * mean agreeing a format with every ERP on the list, which is the thing this
 * whole design exists to avoid.
 */

export const RECEIPT_SUFFIX = ".ok";

/**
 * Check every delivered run that has not been confirmed, and mark the ones the
 * receiving system has acknowledged.
 *
 * Runs after the nightly write rather than on a schedule of its own, so a site
 * with no receipt folder configured costs nothing and a site with one gets
 * yesterday's confirmation with today's drop.
 */
export async function collectReceipts(db: TenantDb, tenant: Tenant, limit = 200): Promise<{ checked: number; acknowledged: number }> {
    const settings = handoffSettings(tenant.settings);
    // No receipt folder means the site never agreed a receipt leg. Every run
    // then stays "delivered, not confirmed", which is the honest state — and
    // the screen says so rather than showing a tick nobody earned.
    if (!settings.receiptFolder.trim()) return { checked: 0, acknowledged: 0 };

    const waiting = await db.exportRun.findMany({
        where: { state: "DELIVERED", acknowledgedAt: null, fileName: { not: null } },
        orderBy: { periodFrom: "desc" },
        take: limit,
        select: { id: true, fileName: true, periodFrom: true, storageDriver: true },
    });

    let acknowledged = 0;
    for (const run of waiting) {
        if (!run.fileName) continue;
        const folder = resolveFolder({ folder: settings.receiptFolder, tenantSlug: tenant.slug, day: run.periodFrom });
        const key = destinationKey(folder, `${run.fileName}${RECEIPT_SUFFIX}`);
        // Read with the driver that wrote the file, so a deployment that has
        // moved to object storage still finds receipts left beside the older
        // drops on disk.
        const driver = run.storageDriver ? driverNamed(run.storageDriver) : storage();

        let there = false;
        try {
            there = await driver.exists(key);
        } catch {
            // A folder that cannot be reached is not an unacknowledged run —
            // it is a broken mount, and saying so belongs to the run that
            // writes, not to the one that reads. Leave the state alone.
            continue;
        }

        if (there) {
            await db.exportRun.update({
                where: { id: run.id },
                data: { state: "ACKNOWLEDGED", acknowledgedAt: new Date(), acknowledgedBy: key },
            });
            acknowledged++;
        }
    }

    return { checked: waiting.length, acknowledged };
}

/**
 * Runs that went out and were never confirmed, oldest first.
 *
 * The number that matters on the screen. One is a receiving system that has
 * not got to it yet; nine in a row is an integration that stopped working on
 * a date somebody can now name.
 */
export async function unconfirmed(db: TenantDb, olderThanDays = 2) {
    const before = new Date(Date.now() - olderThanDays * 86_400_000);
    return db.exportRun.findMany({
        where: { state: "DELIVERED", acknowledgedAt: null, finishedAt: { lt: before }, fileName: { not: null } },
        orderBy: { periodFrom: "asc" },
        take: 60,
        select: { id: true, periodFrom: true, fileName: true, rows: true, finishedAt: true },
    });
}
