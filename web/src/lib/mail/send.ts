import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Mail that MOTION sends itself, as opposed to mail a workshop hands off.
 *
 * This is deliberately not a `MessageDriver`. Everything in `lib/messaging`
 * ends in a `handoff` — a `mailto:` or `wa.me` URL that the workshop clicks in
 * their own client — and that is the right shape for an invoice: the customer's
 * reply should land in the workshop's inbox, not ours, and a workshop can send
 * documents without anybody buying a mail account.
 *
 * A password reset is the opposite case. The recipient is locked out and there
 * is no human on this side to hand anything to, so it has to leave a server on
 * its own. Hence a second, much smaller path, used only for mail that is from
 * MOTION rather than from a workshop.
 *
 * Only SMTP, because the mailbox this sends through is a mailbox — Namecheap
 * Private Email — rather than a transactional HTTP API. That has consequences
 * worth knowing before anything else is routed through here: a mailbox provider
 * rate-limits far more aggressively than a transactional service, and shares
 * its reputation across everything the domain sends. It is sized for the
 * handful of resets a day this flow will produce. It is not sized for sending
 * every workshop's invoices, and pointing bulk mail at it is how the domain
 * ends up unable to send resets either.
 */

export type Mail = {
    to: string;
    subject: string;
    /** Always required. Some clients show it, and a text-only mail still works. */
    text: string;
    html?: string;
    /** A tax invoice, mostly. Kept small: this is a mailbox, not a file service. */
    attachments?: { filename: string; content: Buffer; contentType: string }[];
};

/**
 * One transport, reused. Nodemailer pools connections, and building a fresh
 * transport per message means a fresh TLS handshake and a fresh login against
 * a provider that counts them.
 *
 * It is created on first use rather than at module load so that importing this
 * file — which the reset flow does whether or not mail is configured — cannot
 * fail a build or a page render.
 */
let transport: Transporter | undefined;

function smtpTransport(): Transporter {
    if (transport) return transport;

    const host = required("MAIL_SMTP_HOST");
    const user = required("MAIL_SMTP_USER");
    const pass = required("MAIL_SMTP_PASSWORD");
    const port = Number(process.env.MAIL_SMTP_PORT?.trim() || "465");
    if (!Number.isInteger(port) || port <= 0) throw new Error(`MAIL_SMTP_PORT is not a port: ${process.env.MAIL_SMTP_PORT}`);

    transport = nodemailer.createTransport({
        host,
        port,
        // 465 is TLS from the first byte; 587 starts in the clear and upgrades.
        // `requireTLS` is what makes the upgrade mandatory — without it a server
        // that fails to offer STARTTLS is silently sent credentials in plain
        // text, which is the one failure mode here that must not be quiet.
        secure: port === 465,
        requireTLS: port !== 465,
        auth: { user, pass },
    });
    return transport;
}

function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not set, and MAIL_DRIVER="smtp" needs it. See .env.example.`);
    return value;
}

/**
 * The address mail is from. Its own setting rather than the SMTP username:
 * Private Email authenticates as a mailbox, and sending as an address nobody
 * reads (`no-reply@`) while authenticating as a real mailbox is both normal and
 * what you want — a reply to a reset mail should bounce visibly rather than sit
 * unread in an account nobody opens.
 *
 * It has to be on the signed domain. A From address outside it fails DKIM
 * alignment and the mail is spam-filed however correct the DNS is.
 */
function from(): string {
    const address = required("MAIL_FROM");
    const name = process.env.MAIL_FROM_NAME?.trim() || "MOTION";
    return `"${name.replace(/"/g, "")}" <${address}>`;
}

/**
 * Send, or throw.
 *
 * Throwing is right for the caller this has: a reset that cannot be delivered
 * is a failure the server should record, not something to swallow into a
 * "check your inbox" screen that will never come true. What the *visitor* sees
 * is the caller's decision, and is unchanged either way — see `lib/auth/forgot`
 * on why that screen may not reveal what happened.
 */
export async function sendMail(mail: Mail): Promise<void> {
    const driver = process.env.MAIL_DRIVER?.trim();
    if (driver !== "smtp") throw new Error(`Unknown MAIL_DRIVER ${JSON.stringify(driver)}. The only sender is "smtp".`);

    await smtpTransport().sendMail({
        from: from(),
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
    });
}

/**
 * Check the credentials without sending anything, for `npm run mail:check`.
 * Worth having separately: the first thing that goes wrong with SMTP is the
 * login, and discovering that from a user's failed password reset is late.
 */
export async function verifyMail(): Promise<void> {
    await smtpTransport().verify();
}
