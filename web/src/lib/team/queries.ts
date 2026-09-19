import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

export async function listTeam(db: TenantDb) {
    const [members, invitations] = await Promise.all([
        db.membership.findMany({
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
            select: {
                id: true, group: true, status: true, isMechanic: true, showOnDiary: true, isServiceAdvisor: true,
                user: { select: { firstName: true, lastName: true, email: true, mobile: true } },
            },
        }),
        db.invitation.findMany({
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            select: { id: true, email: true, group: true, expiresAt: true, invitedBy: { select: { firstName: true } } },
        }),
    ]);
    return { members, invitations };
}

export type TeamMember = Awaited<ReturnType<typeof listTeam>>["members"][number];
export type PendingInvitation = Awaited<ReturnType<typeof listTeam>>["invitations"][number];
