"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { unreadCount } from "@/lib/notifications/queries";

/** The number on the bell. Asked for by the bell itself, so it is current on every screen, not only after a full load. */
export async function unreadCountAction(slug: string): Promise<number> {
    const { db, membership } = await requireTenant(slug);
    return unreadCount(db, membership.id);
}

/** Open one: it is read from now on, and the person goes to what it is about. */
export async function openNotificationAction(slug: string, id: string): Promise<void> {
    const { db, membership } = await requireTenant(slug);
    const note = await db.notification.findFirst({ where: { id, membershipId: membership.id }, select: { href: true, readAt: true } });
    if (!note) redirect(`/${slug}/dashboard/notifications`);
    if (!note.readAt) await db.notification.updateMany({ where: { id, membershipId: membership.id }, data: { readAt: new Date() } });
    revalidatePath(`/${slug}/dashboard/notifications`);
    redirect(`/${slug}/${note.href}`);
}

export async function markAllReadAction(slug: string): Promise<void> {
    const { db, membership } = await requireTenant(slug);
    await db.notification.updateMany({ where: { membershipId: membership.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath(`/${slug}/dashboard/notifications`);
}
