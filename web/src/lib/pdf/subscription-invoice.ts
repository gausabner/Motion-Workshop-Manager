import "server-only";
import type { SubscriptionInvoice } from "@prisma/client";
import { CONTENT_WIDTH, INK, MARGIN, createDocument, stampPageNumbers, table, toBuffer, totals, type Column, MINUS } from "@/lib/pdf/kit";
import { drawLetterhead, drawNotes, drawParties, NOTES_WIDTH } from "@/lib/pdf/letterhead";
import { drawMotionLockup } from "@/lib/pdf/motion-mark";
import { asParty } from "@/lib/billing/invoices";
import { billingDay, BILLING_TIME_ZONE } from "@/lib/billing/periods";
import { money as formatMoney } from "@/lib/format";

/**
 * MOTION's tax invoice to a workshop.
 *
 * Laid out by the same kit as every document a workshop sends its own
 * customers, so the layout a workshop owner already trusts is the one they
 * file. What makes it a tax invoice is all here and all from the issued row:
 * the words "tax invoice", the supplier's registered name, address and VAT
 * number, the workshop's name and address (and VAT number where it has one),
 * a serial number and date of issue, what was supplied, and the value, the VAT
 * and the total, each stated separately.
 *
 * It is issued for money already received, so it says so — paid, when, under
 * which reference, nothing due — rather than asking to be paid twice.
 */

const shortDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: BILLING_TIME_ZONE });

export async function renderSubscriptionInvoicePdf(invoice: SubscriptionInvoice): Promise<Buffer> {
    const supplier = asParty(invoice.supplier);
    const recipient = asParty(invoice.recipient);
    const money = (value: number) => formatMoney(value, invoice.currency);
    const excl = Number(invoice.amountExclVat);
    const vat = Number(invoice.vatAmount);
    const incl = Number(invoice.amountInclVat);
    const rate = Number(invoice.vatRate);

    const doc = createDocument(`Tax invoice ${invoice.number}`);

    let y = drawLetterhead(
        doc,
        {
            name: supplier.name,
            registrationNumber: supplier.registrationNumber,
            vatNumber: supplier.vatNumber,
            addressLines: [supplier.tradingAs ? `Trading as ${supplier.tradingAs}` : "", ...supplier.addressLines].filter(Boolean),
            email: supplier.email,
            web: "motionworkshopmanager.com",
            mark: (d, x, top) => drawMotionLockup(d, x, top, 132),
            taxName: "VAT",
        },
        "Tax invoice",
        invoice.number,
    );

    // Paid, in a band, before anything else: the first question somebody
    // opening an invoice asks is whether they still owe it.
    doc.save().rect(MARGIN.left, y - 4, CONTENT_WIDTH, 20).fill("#ecfdf5").restore();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK.accent)
        .text(`Paid in full — thank you. Received ${billingDay(invoice.paidAt)} under reference ${invoice.paymentReference}.`, MARGIN.left + 8, y + 2, {
            width: CONTENT_WIDTH - 16,
        });
    y += 28;

    y = drawParties(
        doc,
        y,
        [
            {
                heading: "Billed to",
                lines: [
                    recipient.name,
                    ...recipient.addressLines,
                    recipient.vatNumber ? `VAT ${recipient.vatNumber}` : "",
                    recipient.registrationNumber ? `Reg ${recipient.registrationNumber}` : "",
                    recipient.email ?? "",
                ],
            },
        ],
        [
            { label: "Invoice number", value: invoice.number },
            { label: "Date of issue", value: shortDay(invoice.issuedAt) },
            { label: "Period from", value: shortDay(invoice.periodFrom) },
            { label: "Period to", value: shortDay(invoice.periodTo) },
            { label: "Payment reference", value: invoice.paymentReference },
        ],
    );

    const columns: Column[] = [
        { key: "description", header: "Description", width: CONTENT_WIDTH - 40 - 100 - 100 },
        { key: "quantity", header: "Qty", width: 40, align: "right" },
        { key: "unit", header: "Unit excl. VAT", width: 100, align: "right" },
        { key: "amount", header: "Amount excl. VAT", width: 100, align: "right" },
    ];
    y = table(doc, y, {
        columns,
        zebra: false,
        rows: [
            {
                description: `${invoice.description}\n${billingDay(invoice.periodFrom)} to ${billingDay(invoice.periodTo)}`,
                quantity: "1",
                unit: money(excl),
                amount: money(excl),
            },
        ],
    });

    y += 10;
    const afterTotals = totals(doc, y, [
        { label: "Total excl. VAT", value: money(excl) },
        { label: `VAT at ${rate % 1 === 0 ? rate.toFixed(0) : rate}%`, value: money(vat) },
        { label: "Total incl. VAT", value: money(incl), strong: true },
        { label: `Paid ${shortDay(invoice.paidAt)}`, value: `${MINUS}${money(incl)}` },
        { label: "Balance due", value: money(0), strong: true },
    ]);

    const notesBottom = drawNotes(
        doc,
        y,
        [
            {
                heading: "About this invoice",
                body: "This is a tax invoice. Keep it with your VAT records: it is what supports a claim for the VAT included above.",
            },
            {
                heading: "Questions",
                body: supplier.email ? `Write to ${supplier.email}, quoting ${invoice.number}.` : `Quote ${invoice.number} in any question about it.`,
            },
        ],
        NOTES_WIDTH,
    );

    doc.y = Math.max(afterTotals, notesBottom);
    stampPageNumbers(doc, `${supplier.name}${supplier.tradingAs ? ` t/a ${supplier.tradingAs}` : ""} · Tax invoice ${invoice.number}`);
    return toBuffer(doc);
}
