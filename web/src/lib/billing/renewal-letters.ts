import "server-only";

import { bankDetails } from "@/lib/billing/config";
import { appUrl, supportAddress, teamAddress } from "@/lib/billing/registration";
import { billingDay } from "@/lib/billing/periods";
import { VAT_RATE, withVat } from "@/lib/pricing/plans";
import { sendMail, type Mail } from "@/lib/mail/send";

type MailAttachment = NonNullable<Mail["attachments"]>[number];
import { money } from "@/lib/format";

/**
 * What a paying workshop is told about its renewal, and what MOTION's team is
 * told each morning.
 *
 * Every letter that asks for money carries everything needed to pay — amount,
 * bank, reference — rather than pointing somewhere else for it. The person
 * reading it on a phone between jobs should be able to pay from the letter.
 */

type Owner = { to: string; firstName: string; workshopName: string };
type Due = Owner & { periodEndsAt: Date; price: number; reference: string };

function payBlock(price: number, reference: string): string[] {
    const bank = bankDetails();
    return [
        `Amount        ${money(withVat(price))} (${money(price)} plus ${VAT_RATE}% VAT)`,
        `Reference     ${reference}`,
        "",
        ...(bank
            ? [
                  `Bank          ${bank.bankName}`,
                  `Account name  ${bank.accountName}`,
                  `Account no    ${bank.accountNumber}`,
                  `Branch code   ${bank.branchCode}`,
                  ...(bank.accountType ? [`Account type  ${bank.accountType}`] : []),
                  "",
              ]
            : []),
        `Please use ${reference} as the payment reference so we can match it to your workshop.`,
    ];
}

function proofLine(): string[] {
    const reach = supportAddress();
    return reach ? ["", `Send the proof of payment to ${reach}. Questions go there too.`] : [];
}

export async function sendRenewalReminder(n: Due & { readOnlyFrom: Date }): Promise<void> {
    const due = billingDay(n.periodEndsAt);
    await sendMail({
        to: n.to,
        subject: `${n.workshopName}: your MOTION subscription is due on ${due}`,
        text: [
            `Hi ${n.firstName},`,
            "",
            `Your MOTION subscription for ${n.workshopName} is paid up to ${due}. To keep everything running, please pay the next month by then.`,
            "",
            ...payBlock(n.price, n.reference),
            ...proofLine(),
            "",
            // Said up front, so the read-only day is never a surprise.
            `If it has not arrived by ${billingDay(n.readOnlyFrom)}, MOTION becomes read-only until it does: you can still see, print and export everything, but new quotes, job cards and invoices are paused.`,
            "",
            "— MOTION",
        ].join("\n"),
    });
}

export async function sendReadOnlyNotice(n: Due): Promise<void> {
    await sendMail({
        to: n.to,
        subject: `${n.workshopName} is read-only on MOTION until your subscription is paid`,
        text: [
            `Hi ${n.firstName},`,
            "",
            `Your MOTION subscription for ${n.workshopName} was due on ${billingDay(n.periodEndsAt)} and we have not received the payment, so MOTION is now read-only.`,
            "",
            "Nothing is lost. You and your team can still sign in, see every customer, vehicle and job, print, and export your books. What is paused is raising new quotes, job cards and invoices.",
            "",
            "Pay the amount below and everything is switched back on as soon as we confirm it:",
            "",
            ...payBlock(n.price, n.reference),
            ...proofLine(),
            "",
            "If you are struggling with cash flow this month, tell us. It is almost always fine.",
            "",
            "— MOTION",
        ].join("\n"),
    });
}

export async function sendRenewalReceipt(
    n: Owner & { slug: string; paidUntil: Date; amountInclVat: number; restored: boolean; invoice?: { number: string; attachment: MailAttachment } },
): Promise<void> {
    const base = appUrl();
    await sendMail({
        to: n.to,
        attachments: n.invoice ? [n.invoice.attachment] : undefined,
        subject: `Payment received — ${n.workshopName} is paid up to ${billingDay(n.paidUntil)}`,
        text: [
            `Hi ${n.firstName},`,
            "",
            `Thank you. We have received your payment of ${money(n.amountInclVat)} and ${n.workshopName} is paid up to ${billingDay(n.paidUntil)}.`,
            ...(n.restored ? ["", "Full access is back: you can raise quotes, job cards and invoices again, with everything exactly where you left it."] : []),
            ...(n.invoice ? ["", `Your tax invoice, ${n.invoice.number}, is attached.`] : []),
            "",
            ...(base ? [`${base}/${n.slug}/dashboard`, ""] : []),
            "— MOTION",
        ].join("\n"),
    });
}

/**
 * A tax invoice on its own — sent again on request, or for a payment recorded
 * after the fact. Short: the attachment is the point.
 */
export async function sendInvoiceLetter(n: Owner & { invoiceNumber: string; amountInclVat: number; attachment: MailAttachment }): Promise<void> {
    const reach = supportAddress();
    await sendMail({
        to: n.to,
        subject: `Tax invoice ${n.invoiceNumber} — ${n.workshopName}`,
        attachments: [n.attachment],
        text: [
            `Hi ${n.firstName},`,
            "",
            `Attached is tax invoice ${n.invoiceNumber} for your MOTION subscription for ${n.workshopName}: ${money(n.amountInclVat)}, already paid. Nothing is due.`,
            "",
            "Keep it with your VAT records. Your invoices are also under Settings → Billing in MOTION.",
            ...(reach ? ["", `Questions to ${reach}, quoting ${n.invoiceNumber}.`] : []),
            "",
            "— MOTION",
        ].join("\n"),
    });
}

/**
 * A credit note cancelling an invoice that should not have been issued. Says
 * plainly that it was MOTION's mistake to correct, that nothing is owed
 * because of it, and where the subscription now stands.
 */
export async function sendCreditNoteLetter(
    n: Owner & { creditNoteNumber: string; invoiceNumber: string; reason: string; paidUntil: Date; attachment: MailAttachment },
): Promise<void> {
    const reach = supportAddress();
    await sendMail({
        to: n.to,
        subject: `Credit note ${n.creditNoteNumber} — cancels invoice ${n.invoiceNumber}`,
        attachments: [n.attachment],
        text: [
            `Hi ${n.firstName},`,
            "",
            `Tax invoice ${n.invoiceNumber} for your MOTION subscription for ${n.workshopName} should not have been issued, so we have cancelled it in full with the attached credit note, ${n.creditNoteNumber}.`,
            "",
            `Reason: ${n.reason}`,
            "",
            `${n.workshopName} is paid up to ${billingDay(n.paidUntil)}. Nothing is owed because of this, and there is nothing for you to do except keep the credit note with the invoice in your VAT records — together they cancel out.`,
            "",
            "Sorry for the confusion.",
            ...(reach ? ["", `Questions to ${reach}, quoting ${n.creditNoteNumber}.`] : []),
            "",
            "— MOTION",
        ].join("\n"),
    });
}

export type DigestLine = { workshopName: string; slug: string; reference: string; periodEndsAt: Date; price: number };

/**
 * The team's morning list. Sent only when the run did something, so an empty
 * inbox means nothing is due rather than that the run stopped.
 */
export async function sendTeamDigest(d: { reminded: DigestLine[]; readOnly: DigestLine[] }): Promise<void> {
    const to = teamAddress();
    if (!to || (d.reminded.length === 0 && d.readOnly.length === 0)) return;
    const base = appUrl();
    const line = (l: DigestLine) =>
        `  ${l.reference}  ${money(withVat(l.price)).padStart(13)}  due ${billingDay(l.periodEndsAt)}  ${l.workshopName} (/${l.slug})`;

    await sendMail({
        to,
        subject: `Renewals: ${[
            d.readOnly.length ? `${d.readOnly.length} now read-only` : "",
            d.reminded.length ? `${d.reminded.length} reminded` : "",
        ]
            .filter(Boolean)
            .join(", ")}`,
        text: [
            ...(d.readOnly.length
                ? ["Past their grace period and now read-only. Their owners have been emailed:", "", ...d.readOnly.map(line), ""]
                : []),
            ...(d.reminded.length ? ["Reminded that their renewal is due:", "", ...d.reminded.map(line), ""] : []),
            "Match payments against these references on the statement, then record them here:",
            "",
            base ? `${base}/admin` : "/admin",
            "",
            "— MOTION",
        ].join("\n"),
    });
}
