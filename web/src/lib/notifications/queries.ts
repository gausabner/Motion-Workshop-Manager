import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/** A person's notifications, newest first, and how many they have not opened. */
export async function notificationsFor(db: TenantDb, membershipId: string, take = 60) {
    return db.notification.findMany({
        where: { membershipId },
        orderBy: { createdAt: "desc" },
        take,
        select: { id: true, kind: true, title: true, body: true, href: true, createdAt: true, readAt: true },
    });
}

export async function unreadCount(db: TenantDb, membershipId: string): Promise<number> {
    return db.notification.count({ where: { membershipId, readAt: null } });
}
