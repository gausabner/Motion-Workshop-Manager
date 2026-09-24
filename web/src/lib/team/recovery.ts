import { createHash, randomBytes } from "node:crypto";
import type { Membership } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { TenantTx } from "@/lib/tenant-db";

/**
 * Getting somebody back into MOTION when they cannot sign in.
 *
 * There was no way to do this at all — not for the person who forgot, and not
 * for the owner. In a workshop that is a working outage for one member of staff
 * until somebody edits the database by hand, and it happens within the first
 * month of real use.
 *
 * The link is issued by an owner or admin and handed over however they like:
 * WhatsApp, read out, typed on the spot. That is deliberate rather than a
 * shortcut — MOTION sends documents the same way precisely so a workshop needs
 * no mail provider to work, and the person who forgot their password is almost
 * always standing in the same building as the person who can help.
 *
 * Self-service "I forgot my password" is the other half and waits for an email
 * provider. When it comes, two rules: the reply must be identical whether or
 * not the address exists, or the form becomes a way to discover who works
 * there, and the link expires in an hour rather than days.
 */

/** Short, because a reset link is a way into somebody's account. */
const RESET_HOURS = 24;

function secret(): string {
    const value = process.env.SESSION_SECRET;
    if (!value || value.length < 16) throw new Error("SESSION_SECRET is not set (see .env.example)");
    return value;
}

/**
 * Hashed with a different prefix from invitations, so a token minted for one
 * purpose cannot be presented for the other even if the raw value escaped.
 */
export function hashResetToken(token: string): string {
    return createHash("sha256").update(`reset.${token}.${secret()}`).digest("hex");
}

export async function issuePasswordReset(
    tx: TenantTx,
    tenantId: string,
    actor: Pick<Membership, "id">,
    membershipId: string,
): Promise<{ token: string; expiresAt: Date; name: string }> {
    const target = await tx.membership.findUnique({
        where: { id: membershipId },
        select: { userId: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!target) throw new Error("That person is no longer on the team.");

    // One live link per person: issuing a new one retires the last, so a link
    // read out last week cannot still be used by whoever overheard it.
    await tx.passwordReset.updateMany({
        where: { userId: target.userId, usedAt: null, expiresAt: { gt: new Date() } },
        data: { expiresAt: new Date() },
    });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + RESET_HOURS * 3_600_000);
    await tx.passwordReset.create({
        data: { tenantId, userId: target.userId, token: hashResetToken(token), expiresAt, issuedById: actor.id },
    });

    // Until they use it, the account is in the same position as one whose
    // password an admin has just set: somebody else can get in.
    await tx.user.update({ where: { id: target.userId }, data: { mustChangePassword: true } });

    return { token, expiresAt, name: `${target.user.firstName} ${target.user.lastName}`.trim() };
}

/** What the reset page shows before anyone types. Null when the link is dead. */
export async function findPasswordReset(token: string) {
    const row = await prisma.passwordReset.findUnique({
        where: { token: hashResetToken(token) },
        select: {
            id: true,
            expiresAt: true,
            usedAt: true,
            user: { select: { email: true, firstName: true } },
            tenant: { select: { slug: true, name: true, isActive: true } },
        },
    });
    if (!row || row.usedAt || row.expiresAt < new Date() || !row.tenant.isActive) return null;
    return row;
}

/**
 * Spend the link and set the password.
 *
 * Every existing session for that user is ended in the same transaction. If the
 * reason for the reset is that somebody else had the password — or simply might
 * have — leaving their session alive makes the whole exercise decorative.
 */
export async function consumePasswordReset(token: string, password: string): Promise<{ slug: string } | null> {
    const hashed = hashResetToken(token);
    return prisma.$transaction(async (tx) => {
        // Locked so two people following the same link cannot both spend it.
        const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "PasswordReset" WHERE token = ${hashed} FOR UPDATE`;
        if (rows.length === 0) return null;
        const row = await tx.passwordReset.findUniqueOrThrow({
            where: { id: rows[0].id },
            select: { id: true, userId: true, usedAt: true, expiresAt: true, tenant: { select: { slug: true, isActive: true } } },
        });
        if (row.usedAt || row.expiresAt < new Date() || !row.tenant.isActive) return null;

        await tx.user.update({
            where: { id: row.userId },
            data: { passwordHash: await hashPassword(password), mustChangePassword: false },
        });
        await tx.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
        await tx.session.deleteMany({ where: { userId: row.userId } });
        return { slug: row.tenant.slug };
    });
}

/**
 * Create somebody outright, rather than inviting them.
 *
 * Two shapes, because a workshop has two situations. An apprentice is standing
 * at the counter with no email address: the owner types a first password and
 * says it out loud. A bookkeeper will set themselves up on Monday: the owner
 * makes a link instead.
 *
 * Either way `mustChangePassword` is set, so the password the owner typed stops
 * working the moment it is used. Without that the owner permanently knows a
 * password that signs in as somebody else, and every entry that account leaves
 * in the audit trail becomes deniable — which is most of what an audit trail is
 * for.
 */
export async function createMemberDirectly(
    tx: TenantTx,
    tenantId: string,
    actor: Pick<Membership, "id">,
    input: {
        email: string;
        firstName: string;
        lastName: string;
        mobile?: string;
        group: Membership["group"];
        /** Omitted when the owner wants a link instead of typing a password. */
        password?: string;
    },
): Promise<{ membershipId: string; token?: string }> {
    const email = input.email.trim().toLowerCase();
    const clash = await tx.membership.findFirst({ where: { user: { email } }, select: { status: true } });
    if (clash?.status === "ACTIVE") throw new Error("That person is already on the team.");

    // An existing MOTION account keeps its own password; joining another
    // workshop is not a reason to reset one they already use.
    let user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
        user = await tx.user.create({
            data: {
                email,
                firstName: input.firstName.trim(),
                lastName: input.lastName.trim(),
                mobile: input.mobile?.trim() || null,
                // A placeholder nobody can sign in with. Either the owner's
                // password replaces it below, or the link does.
                passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
                mustChangePassword: true,
            },
            select: { id: true },
        });
    }

    const membership = await tx.membership.create({
        data: { tenantId, userId: user.id, group: input.group, status: "ACTIVE" },
        select: { id: true },
    });

    if (input.password) {
        await tx.user.update({
            where: { id: user.id },
            data: { passwordHash: await hashPassword(input.password), mustChangePassword: true },
        });
        return { membershipId: membership.id };
    }

    const issued = await issuePasswordReset(tx, tenantId, actor, membership.id);
    return { membershipId: membership.id, token: issued.token };
}
