"use server";

import { requireTenant } from "@/lib/auth/session";
import { jobSheet, scheduleMonth } from "@/lib/time/floor-sheet";

/** What the floor app's job sheet reads. Read only; any member of the workshop may open a job card. */
export async function jobSheetAction(slug: string, documentId: string) {
    const { db, membership } = await requireTenant(slug);
    return jobSheet(db, documentId, membership.id);
}

/** Another month for the floor app's calendar, as "2026-12". */
export async function scheduleAction(slug: string, month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("A month reads like 2026-12.");
    const { db, tenant, membership } = await requireTenant(slug);
    return scheduleMonth(db, tenant, membership.id, month);
}
