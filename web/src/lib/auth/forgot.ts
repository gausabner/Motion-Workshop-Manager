import "server-only";

import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail/send";
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

    // Silence, deliberately. Not an error — the caller returns the same screen
    // either way, and `after` below keeps it the same *length* of time too.
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

    // Delivery happens after the response, and cannot fail into it.
    //
    // Two separate leaks are being closed here, and both are leaks of the same
    // fact — whether this address is on an account.
    //
    // **The error page.** A sender that throws undoes every careful line above
    // from the outside: an unknown address returns quietly, a known one with a
    // broken mailbox returns a server error. So a failure is recorded on the
    // server and swallowed. The visitor is then told to check an inbox for mail
    // that is not coming, which is the lesser of the two and is why
    // `npm run mail:check` exists — the answer to silent failure is noticing
    // before a user does, not telling an unauthenticated caller what is real.
    //
    // **The clock.** Measured, before this was moved: 3,187 ms for an address
    // on an account against 7 ms for one that is not. An SMTP handshake is not
    // a subtle side channel at that scale; anybody can time the form in a
    // browser and read the answer straight off, which makes the identical copy
    // decorative. `after` runs this once the response is already on its way, so
    // both paths return in single-digit milliseconds and the difference is the
    // database round trip rather than a mail server.
    //
    // `after` is used rather than a bare dangling promise because Next keeps
    // the work alive until it settles instead of letting it be cut off when the
    // request finishes. Outside a request — a script, a test — there is nothing
    // to run after, so it is awaited inline; the same work either way.
    const deliver = () =>
        deliverResetLink({
            email,
            firstName: user.firstName,
            workshop: membership.tenant.name,
            token,
            expiresAt,
        }).catch((error: unknown) => {
            console.error("[forgot] a reset link was minted and could not be sent.", {
                to: email,
                workshop: membership.tenant.name,
                error: error instanceof Error ? error.message : String(error),
            });
        });

    try {
        after(deliver);
    } catch {
        await deliver();
    }
}

/**
 * Where the link goes.
 *
 * Every other channel MOTION has is a *hand-off* — a `wa.me` link or a
 * `mailto:` URL that a human clicks in their own client — which is deliberate,
 * and is what lets a workshop send invoices without anybody buying a mail
 * provider. It is exactly the wrong shape here: the person who needs this link
 * is locked out and alone, and there is nobody to hand anything to. So this one
 * path sends for itself, through `lib/mail/send`.
 *
 * Mail stays optional. With no `MAIL_DRIVER` the request is still recorded, the
 * link is still minted, and this logs loudly on the server while the visitor
 * sees the same neutral screen — because telling them "email is not configured"
 * would also tell them their address exists. That is the state a developer
 * working locally is in, and it should not be a crash.
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

    // The token is passed in rather than a finished URL so that the address in
    // the mail is built here, from `base`, next to the check that `base` exists.
    const link = `${base}/reset/${message.token}`;
    const minutes = Math.max(1, Math.round((message.expiresAt.getTime() - Date.now()) / 60_000));

    await sendMail({
        to: message.email,
        // No workshop name in the subject. A subject line shows on a lock
        // screen, and this mail goes to an address that may not be the
        // person's — naming their workshop there is the same leak the neutral
        // screen above exists to prevent.
        subject: "Reset your MOTION password",
        text: [
            `Hi ${message.firstName},`,
            "",
            `Somebody asked to reset the MOTION password for ${message.workshop}. If that was you, open this link:`,
            "",
            link,
            "",
            `It works once, and for ${minutes} minutes.`,
            "",
            "If it wasn't you, nothing has changed and you can ignore this. Your current password still works.",
            "",
            "— MOTION",
        ].join("\n"),
        html: resetHtml({ firstName: message.firstName, workshop: message.workshop, link, minutes }),
    });
}

/** The entities that matter in an attribute or a text node, and no others. */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * The same words as the text part, in a shape a mail client will render.
 *
 * Table-free, inline-styled and narrow on purpose: mail clients strip
 * stylesheets, ignore most selectors and render at widths nobody chose. The
 * link is also written out in full underneath the button, because a client that
 * refuses to render the button at all is common enough that a reset must not
 * depend on one.
 *
 * `firstName` and `workshop` come from the database and are escaped. They are
 * typed by a user at sign-up, so they are not safe to interpolate — a workshop
 * called `Mike & Sons <Pty>` would otherwise arrive broken, which is the benign
 * version of the same bug.
 */
function resetHtml(parts: { firstName: string; workshop: string; link: string; minutes: number }): string {
    const name = escapeHtml(parts.firstName);
    const workshop = escapeHtml(parts.workshop);
    // The URL is ours — base from config, token from `randomBytes(...).toString("base64url")`,
    // whose alphabet has nothing to escape. Escaped anyway, so that a future
    // change to either cannot quietly turn this into an injection.
    const href = escapeHtml(parts.link);

    return `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.5">Hi ${name},</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.5">Somebody asked to reset the MOTION password for <strong>${workshop}</strong>. If that was you, set a new one here.</p>
    <p style="margin:0 0 24px">
      <a href="${href}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:12px 20px;border-radius:8px">Set a new password</a>
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#475569">It works once, and for ${parts.minutes} minutes. If the button does nothing, copy this into your browser:<br>
      <span style="word-break:break-all;color:#0f766e">${href}</span>
    </p>
    <p style="margin:0;font-size:14px;line-height:1.5;color:#475569">If it wasn't you, nothing has changed and you can ignore this — your current password still works.</p>
  </div>
</body></html>`;
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
