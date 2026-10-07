import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * The `motion.platform_admin` transaction itself, apart from any session.
 *
 * Its own module so the daily renewal run — which has no signed-in person and
 * is tested outside a request — can use it without importing the login code.
 * `asStaff` in `platform.ts` is the way in for people; `asScheduler` here is
 * the way in for the timer.
 */

/**
 * The same exemption for MOTION's own scheduled work, which has no signed-in
 * person behind it: the daily renewal run.
 *
 * The one other way to set the flag, and deliberately awkward to reach — it
 * takes the bearer secret the run is called with, already checked, as proof
 * that the caller is the scheduler and not a page that wanted a shortcut. What
 * it opens is no wider than for staff: the billing tables, and nothing of a
 * workshop's own.
 */
export async function asScheduler<T>(proof: { schedulerSecretChecked: true }, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (proof.schedulerSecretChecked !== true) throw new Error("asScheduler: the scheduler secret was not checked");
    return platformTransaction(fn);
}

export function platformTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('motion.platform_admin', 'on', true)`;
        return fn(tx);
    });
}
