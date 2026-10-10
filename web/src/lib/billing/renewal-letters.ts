import "server-only";

import { bankDetails } from "@/lib/billing/config";
import { appUrl, supportAddress, teamAddress } from "@/lib/billing/registration";
import { billingDay } from "@/lib/billing/periods";
import { VAT_RATE, withVat } from "@/lib/pricing/plans";
import { SIGN_OFF, sendMail, type Mail } from "@/lib/mail/send";

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
        `Use ${reference} as the payment reference, so that we can match the payment to your workshop.`,
    ];
}

function proofLine(): string[] {
    const reach = supportAddress();
    return reach ? ["", `Send the proof of payment to ${reach}. Questions can be sent to the same address.`] : [];
}

export async function sendRenewalReminder(n: Due & { readOnlyFrom: Date }): Promise<void> {
    const due = billingDay(n.periodEndsAt);
    await sendMail({
        to: n.to,
        subject: `${n.workshopName}: your MOTION subscription is due on ${due}`,
        text: [
            `Hello ${n.firstName},`,
            "",
            `Your MOTION subscription for ${n.workshopName} is paid up to ${due}. Please make the next payment by that date.`,
            "",
            ...payBlock(n.price, n.reference),
            ...proofLine(),
            "",
            // Said up front, so the read-only day is never a surprise.
            `If the payment has not been received by ${billingDay(n.readOnlyFrom)}, MOTION becomes read-only until it is. You will still be able to view, print and export everything, but not create quotes, job cards or invoices.`,
            "",
            ...SIGN_OFF,
        ].join("\n"),
    });
}

export async function sendReadOnlyNotice(n: Due): Promise<void> {
    await sendMail({
        to: n.to,
        subject: `${n.workshopName} is read-only on MOTION until your subscription is paid`,
        text: [
            `Hello ${n.firstName},`,
            "",
            `Your MOTION subscription for ${n.workshopName} was due on ${billingDay(n.periodEndsAt)} and we have not received the payment, so MOTION is now read-only.`,
            "",
            "Nothing has been lost. You and your team can still sign in, view every customer, vehicle and job, print, and export your records. Creating quotes, job cards and invoices is paused.",
            "",
            "Pay the amount below, and full access is restored as soon as we confirm the payment:",
            "",
            ...payBlock(n.price, n.reference),
            ...proofLine(),
            "",
            "If cash flow is difficult this month, contact us. We can usually make an arrangement.",
            "",
            ...SIGN_OFF,
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
            `Hello ${n.firstName},`,
            "",
            `Thank you. We have received your payment of ${money(n.amountInclVat)} and ${n.workshopName} is paid up to ${billingDay(n.paidUntil)}.`,
            ...(n.restored ? ["", "Full access has been restored. You can create quotes, job cards and invoices again, and your records are as you left them."] : []),
            ...(n.invoice ? ["", `Your tax invoice, ${n.invoice.number}, is attached.`] : []),
            "",
            ...(base ? [`${base}/${n.slug}/dashboard`, ""] : []),
            ...SIGN_OFF,
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
            `Hello ${n.firstName},`,
            "",
            `Tax invoice ${n.invoiceNumber} for your MOTION subscription for ${n.workshopName} is attached: ${money(n.amountInclVat)}, already paid. Nothing is due.`,
            "",
            "Keep it with your VAT records. All your invoices are also available under Settings → Billing in MOTION.",
            ...(reach ? ["", `If you have any questions, contact ${reach} and quote ${n.invoiceNumber}.`] : []),
            "",
            ...SIGN_OFF,
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
            `Hello ${n.firstName},`,
            "",
            `Tax invoice ${n.invoiceNumber} for your MOTION subscription for ${n.workshopName} should not have been issued, so we have cancelled it in full with the attached credit note, ${n.creditNoteNumber}.`,
            "",
            `Reason: ${n.reason}`,
            "",
            `${n.workshopName} is paid up to ${billingDay(n.paidUntil)}. Nothing is owed as a result. Keep the credit note with the invoice in your VAT records; together they cancel each other out.`,
            "",
            "We apologise for the error.",
            ...(reach ? ["", `If you have any questions, contact ${reach} and quote ${n.creditNoteNumber}.`] : []),
            "",
            ...SIGN_OFF,
        ].join("\n"),
    });
}

/**
 * A workshop moved to another plan. What changes now (what they can reach),
 * and what changes later (the price, from the next renewal) — said apart,
 * because those are the two questions an owner has.
 */
export async function sendPlanChangedLetter(
    n: Owner & { slug: string; planName: string; price: number; nextRenewal: Date | null; gained: string[]; lost: string[] },
): Promise<void> {
    const base = appUrl();
    const reach = supportAddress();
    await sendMail({
        to: n.to,
        subject: `${n.workshopName} is now on the ${n.planName} plan`,
        text: [
            `Hello ${n.firstName},`,
            "",
            `${n.workshopName} is now on MOTION's ${n.planName} plan.`,
            ...(n.gained.length ? ["", "Available from today:", ...n.gained.map((g) => `  • ${g}`)] : []),
            ...(n.lost.length ? ["", "No longer included (your records are kept):", ...n.lost.map((g) => `  • ${g}`)] : []),
            "",
            n.nextRenewal
                ? `From your next renewal on ${billingDay(n.nextRenewal)}, the subscription is ${money(withVat(n.price))} a month (${money(n.price)} plus ${VAT_RATE}% VAT). Amounts already paid are not affected.`
                : `The subscription is ${money(withVat(n.price))} a month (${money(n.price)} plus ${VAT_RATE}% VAT).`,
            ...(base ? ["", `${base}/${n.slug}/dashboard`] : []),
            ...(reach ? ["", `If you have any questions, contact ${reach}.`] : []),
            "",
            ...SIGN_OFF,
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
