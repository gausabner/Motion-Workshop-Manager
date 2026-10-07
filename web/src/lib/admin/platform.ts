import "server-only";

import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, type SessionUser } from "@/lib/auth/session";

/**
 * MOTION's own staff, and the one database exemption they hold.
 *
 * Two functions, and the second cannot be reached without the first. That is
 * the design, not a convenience: `motion.platform_admin` lifts row-level
 * security on the billing tables, so the only way to set it is through
 * `asStaff`, which has already established — from this database, for the
 * signed-in user — that the person is staff. There is no exported way to set
 * the flag without that check, so a future page cannot forget to make it.
 *
 * What the flag grants is decided in the migration, not here: Subscription and
 * PlatformAuditEvent, and nothing that holds a workshop's own work. Code in
 * this file could ask for a customer list and the database would hand back an
 * empty one.
 */

/**
 * The signed-in user, if they are MOTION staff — otherwise a 404.
 *
 * A 404 rather than a 403 so that /admin does not confirm it exists to
 * somebody probing. And `isPlatformStaff` is read fresh from the database on
 * every request rather than trusted from the session, so revoking it takes
 * effect on the next click instead of whenever the session happens to expire.
 */
export async function requirePlatformStaff(): Promise<SessionUser> {
    const user = await requireUser("/admin");
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { isPlatformStaff: true } });
    if (!row?.isPlatformStaff) notFound();
    return user;
}

/**
 * Run `fn` as platform staff: inside one transaction, with the flag set for
 * that transaction only.
 *
 * Transaction-local (`set_config(..., true)`) so the setting and the queries
 * share one pooled connection and the flag cannot leak to whoever borrows that
 * connection next — the failure mode that would matter most.
 */
export async function asStaff<T>(fn: (tx: Prisma.TransactionClient, staff: SessionUser) => Promise<T>): Promise<T> {
    const staff = await requirePlatformStaff();
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('motion.platform_admin', 'on', true)`;
        return fn(tx, staff);
    });
}
