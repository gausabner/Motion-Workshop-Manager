import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { hashResetToken } from "@/lib/team/recovery";

/**
 * "I forgot my password", started by the person who forgot it.
 *
 * The other half of `lib/team/recovery`, which lets an owner issue a link by
 * hand. That covers a mechanic standing in the same building as the owner. It
 * does not cover the owner themselves at seven in the morning, which is the
 * case that matters most and the one that had no answer at all.
 *
 * Two rules, both load-bearing:
 *
 * **The answer is identical whether or not the address exists.** Otherwise the
 * form becomes a way to find out who works at a given workshop — type an
 * address, read the reply. That is worth more to somebody hostile than it
 * sounds, and it costs nothing to prevent. The caller is given no way to tell
 * the difference, so a careless `if (found)` further up cannot leak it either.
 *
 * **An hour, not a day.** An admin-issued link lives for 24 hours because it
 * is handed to somebody in person and may wait until after lunch. One minted
 * by an unauthenticated form is a different risk: it arrives in a mailbox that
 * may itself be compromised, and nobody is waiting on it.
 */

const SELF_SERVE_MINUTES = 60;

/**
 * A user may belong to more than one workshop. The reset is per membership in
 * the schema, so the most recently active one is chosen — the account somebody
 * is trying to get back into is almost always the one they last used, and
 * offering a choice would require naming their workshops to an unauthenticated
 * caller.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            firstName: true,
            memberships: {
                where: { tenant: { isActive: true } },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, tenantId: true, tenant: { select: { slug: true, name: true } } },
            },
        },
    });

    // Silence, deliberately. Not an error, not a different timing path worth
    // worrying about at this scale — the caller returns the same screen either
    // way.
    const membership = user?.memberships[0];
    if (!user || !membership) return;

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SELF_SERVE_MINUTES * 60_000);

    await prisma.$transaction(async (tx) => {
        // One live link per person, as with an issued one: a request retires
        // whatever came before it, so somebody who clicks "send it again"
        // three times cannot leave three working links behind.
        await tx.passwordReset.updateMany({
            where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
            data: { expiresAt: new Date() },
        });
        await tx.passwordReset.create({
            data: {
                userId: user.id,
                tenantId: membership.tenantId,
                token: hashResetToken(token),
                expiresAt,
                // Self-issued: the person asking is the person it is for. The
                // column is not null in the schema, and recording the
                // membership keeps a reset answerable to somebody either way.
                issuedById: membership.id,
            },
        });
    });

    await deliverResetLink({
        email,
        firstName: user.firstName,
        workshop: membership.tenant.name,
        token,
        expiresAt,
    });
}

/**
 * Where the link goes.
 *
 * MOTION has no transactional mail sender. Every channel it has is a *hand-off*
 * — a `wa.me` link or a `mailto:` URL that a human clicks in their own client —
 * which is deliberate, and is what lets a workshop send invoices without
 * anybody buying a mail provider. It is also exactly the wrong shape here: the
 * person who needs this link is locked out and alone, and there is nobody to
 * hand anything to.
 *
 * So this needs a real sender. It is written as the seam for one rather than
 * left as a hole: configure `MAIL_DRIVER` and the flow completes. Until then
 * the request is recorded, the link is minted, and this logs loudly on the
 * server while the visitor still sees the same neutral screen — because
 * telling them "email is not configured" would also tell them their address
 * exists.
 */
async function deliverResetLink(message: {
    email: string;
    firstName: string;
    workshop: string;
    token: string;
    expiresAt: Date;
}): Promise<void> {
    const driver = process.env.MAIL_DRIVER?.trim();
    const base = process.env.APP_URL?.trim().replace(/\/$/, "");

    if (!base) {
        // Without this the link is relative and useless in a mailbox. Worth
        // its own message: it is a different mistake from having no sender,
        // and it would otherwise surface as a reset link nobody can click.
        console.error("[forgot] APP_URL is not set, so a reset link cannot be addressed. See .env.example.");
        return;
    }

    if (!driver) {
        console.error(
            "[forgot] MAIL_DRIVER is not configured. A reset link was minted and could not be sent.",
            { to: message.email, workshop: message.workshop, expiresAt: message.expiresAt.toISOString() },
        );
        return;
    }

    // A sender slots in here and builds the link itself:
    //
    //     const link = `${base}/reset/${message.token}`;
    //     await send({ to: message.email, subject: ..., body: ... });
    //
    // The token is passed in rather than the finished URL so the sender owns
    // the address it puts in the mail — the same reason `base` is read here
    // and checked above rather than assumed.
    throw new Error(
        `Unknown MAIL_DRIVER ${JSON.stringify(driver)}. Add a transactional sender, or unset it to fall back to logging.`,
    );
}

/**
 * The link is deliberately not logged, in either branch above.
 *
 * It is a single-use key to somebody's account for the next hour. Server logs
 * are read by more people than a mailbox is, are shipped to places nobody
 * audits, and outlive the hour by months — printing it "just while we get mail
 * working" is how a convenience becomes the way in. What is logged is enough
 * to know a request happened and to whom, and nothing that grants anything.
 */
