import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Membership, MembershipStatus, UserGroup } from "@prisma/client";
import { prisma } from "@/lib/db";
import { announceTenant } from "@/lib/tenant-db";
import type { TenantTx } from "@/lib/tenant-db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { INVITE_DAYS, flagsForGroup, invitableGroups, memberChangeError } from "@/lib/team/rules";

/**
 * The team: invitations and the people already in the workshop.
 *
 * An invitation is a link, like every other link MOTION sends — 32 random
 * bytes, only the hash kept, seven days to use it. The owner hands it over by
 * WhatsApp or email from their own phone; nobody at MOTION ever sees it.
 */

function secret(): string {
    const value = process.env.SESSION_SECRET;
    if (!value || value.length < 16) throw new Error("SESSION_SECRET is not set (see .env.example)");
    return value;
}

export function hashInviteToken(token: string): string {
    return createHash("sha256").update(`invite.${token}.${secret()}`).digest("hex");
}

export async function createInvitation(
    tx: TenantTx,
    tenantId: string,
    actor: Pick<Membership, "group" | "userId">,
    input: { email: string; group: UserGroup },
): Promise<{ id: string; token: string; expiresAt: Date }> {
    if (!invitableGroups(actor.group).includes(input.group)) throw new Error("Only an owner can invite another owner.");
    const email = input.email.trim().toLowerCase();
    const existing = await tx.membership.findFirst({ where: { user: { email } }, select: { status: true } });
    if (existing?.status === "ACTIVE") throw new Error("That person is already on the team.");

    // One live invitation per address: a fresh one retires the last.
    await tx.invitation.updateMany({ where: { email, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { expiresAt: new Date() } });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
    const invitation = await tx.invitation.create({
        data: { tenantId, email, group: input.group, token: hashInviteToken(token), expiresAt, invitedById: actor.userId },
        select: { id: true },
    });
    return { id: invitation.id, token, expiresAt };
}

export async function revokeInvitation(tx: TenantTx, id: string): Promise<void> {
    await tx.invitation.updateMany({ where: { id, acceptedAt: null }, data: { expiresAt: new Date() } });
}

export type MemberUpdate = { group: UserGroup; status: MembershipStatus; isMechanic: boolean; showOnDiary: boolean; isServiceAdvisor: boolean };

export async function updateMember(
    tx: TenantTx,
    tenantId: string,
    actor: Pick<Membership, "id" | "group" | "status">,
    membershipId: string,
    change: MemberUpdate,
): Promise<void> {
    // Serialise owner changes, so two owners demoting each other at once cannot leave none.
    await tx.$queryRaw`SELECT id FROM "Membership" WHERE "tenantId" = ${tenantId} AND "group" = 'OWNER' FOR UPDATE`;
    const target = await tx.membership.findUnique({ where: { id: membershipId }, select: { id: true, group: true, status: true } });
    if (!target) throw new Error("That person is no longer on the team.");
    const owners = await tx.membership.count({ where: { group: "OWNER", status: "ACTIVE" } });
    const error = memberChangeError(actor, target, change, owners);
    if (error) throw new Error(error);
    await tx.membership.update({ where: { id: membershipId }, data: change });
}

/** What the join page shows before anyone types anything. Null when the link is dead. */
export async function findInvitation(token: string) {
    const invitation = await prisma.invitation.findUnique({
        where: { token: hashInviteToken(token) },
        select: { id: true, email: true, group: true, expiresAt: true, acceptedAt: true, tenant: { select: { name: true, slug: true, isActive: true } } },
    });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date() || !invitation.tenant.isActive) return null;
    const hasAccount = (await prisma.user.count({ where: { email: invitation.email } })) > 0;
    return { ...invitation, hasAccount };
}

export type AcceptInput = { firstName?: string; lastName?: string; mobile?: string; password: string };

/**
 * Join the workshop. Someone who already has a MOTION account proves it with
 * their password rather than getting a second account; everyone else sets one.
 */
export async function acceptInvitation(token: string, input: AcceptInput): Promise<{ userId: string; tenantId: string; slug: string }> {
    const tokenHash = hashInviteToken(token);
    const passwordHash = await hashPassword(input.password);
    return prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Invitation" WHERE token = ${tokenHash} FOR UPDATE`;
        if (rows.length === 0) throw new Error("This invitation link is not valid.");
        const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: rows[0].id }, include: { tenant: { select: { slug: true, isActive: true } } } });
        if (invitation.acceptedAt) throw new Error("This invitation has already been used. Sign in instead.");
        if (invitation.expiresAt < new Date() || !invitation.tenant.isActive) throw new Error("This invitation has expired. Ask the workshop for a new one.");

        let user = await tx.user.findUnique({ where: { email: invitation.email } });
        if (user) {
            if (!(await verifyPassword(input.password, user.passwordHash))) throw new Error("That is not the password for this account.");
        } else {
            if (!input.firstName || !input.lastName) throw new Error("Enter your first and last name.");
            user = await tx.user.create({ data: { email: invitation.email, passwordHash, firstName: input.firstName, lastName: input.lastName, mobile: input.mobile } });
        }

        const flags = flagsForGroup(invitation.group);
        await tx.membership.upsert({
            where: { userId_tenantId: { userId: user.id, tenantId: invitation.tenantId } },
            create: { tenantId: invitation.tenantId, userId: user.id, group: invitation.group, ...flags },
            update: { group: invitation.group, status: "ACTIVE", ...flags },
        });
        // The membership about to be created is what would normally establish
        // the tenant, so it has to be named explicitly here.
        await announceTenant(tx, invitation.tenantId);
        await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
        await tx.auditEvent.create({
            data: { tenantId: invitation.tenantId, actorUserId: user.id, entityType: "Invitation", entityId: invitation.id, action: "ACCEPTED" },
        });
        return { userId: user.id, tenantId: invitation.tenantId, slug: invitation.tenant.slug };
    });
}
