import "server-only";
import { CONTENT_WIDTH, INK, MARGIN, PAGE, caption, createDocument, rule, stampPageNumbers, table, toBuffer, type Column } from "@/lib/pdf/kit";
import { money as formatMoney } from "@/lib/format";
import { drawLetterhead, drawNotes, drawParties, type Letterhead } from "@/lib/pdf/letterhead";

/**
 * The statement a workshop sends when it wants paying.
 *
 * The running balance down the right is the whole point: a customer can follow
 * the arithmetic to the closing figure rather than being asked to trust it,
 * and the ageing strip at the bottom is what makes "this is 90 days old" a
 * fact rather than a phone call.
 */

export type StatementPdfInput = {
    workshop: Letterhead;
    currency: string;
    customer: { name: string; lines: string[] };
    from: string;
    to: string;
    opening: number;
    rows: { date: string; detail: string; number: string | null; amount: number; balance: number }[];
    closing: number;
    ageing: { label: string; value: number }[];
    unapplied: number;
    footer: string;
};

export async function renderStatementPdf(input: StatementPdfInput): Promise<Buffer> {
    const money = (value: number) => formatMoney(value, input.currency);
    const doc = createDocument(`Statement ${input.customer.name}`);

    let y = drawLetterhead(doc, input.workshop, "Statement", `${input.from} to ${input.to}`);
    y = drawParties(doc, y, [{ heading: "Account", lines: [input.customer.name, ...input.customer.lines] }], [
        { label: "Statement date", value: input.to },
        { label: "Balance due", value: money(input.closing) },
    ]);

    const columns: Column[] = [
        { key: "date", header: "Date", width: 68 },
        { key: "detail", header: "Detail", width: CONTENT_WIDTH - 68 - 96 - 100 - 100 },
        { key: "number", header: "Number", width: 96, muted: true },
        { key: "amount", header: "Amount", width: 100, align: "right" },
        { key: "balance", header: "Balance", width: 100, align: "right" },
    ];

    y = table(doc, y, {
        columns,
        rows: [
            { date: input.from, detail: "Balance brought forward", number: "", amount: "", balance: money(input.opening) },
            ...input.rows.map((row) => ({
                date: row.date,
                detail: row.detail,
                number: row.number ?? "",
                amount: money(row.amount),
                balance: money(row.balance),
            })),
        ],
        onNewPage: (page) => drawLetterhead(page, input.workshop, "Statement", `${input.from} to ${input.to}`),
    });

    y += 12;
    if (y > PAGE.height - MARGIN.bottom - 90) {
        doc.addPage();
        y = MARGIN.top;
    }

    // The ageing strip: one cell per bucket, the oldest in red because that is the one to ring about.
    const cellWidth = CONTENT_WIDTH / (input.ageing.length + 1);
    let x = MARGIN.left;
    doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, 34).fill(INK.band).restore();
    for (const [index, bucket] of input.ageing.entries()) {
        caption(doc, bucket.label, x + 8, y + 6, cellWidth - 12);
        const oldest = index === input.ageing.length - 1 && bucket.value > 0;
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(oldest ? INK.danger : INK.text).text(money(bucket.value), x + 8, y + 18, { width: cellWidth - 12 });
        x += cellWidth;
    }
    caption(doc, "Balance due", x + 8, y + 6, cellWidth - 12);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK.text).text(money(input.closing), x + 8, y + 17, { width: cellWidth - 12 });
    rule(doc, y);
    rule(doc, y + 34);
    y += 44;

    y = drawNotes(doc, y, [
        ...(input.unapplied > 0 ? [{ body: `Includes ${money(input.unapplied)} already paid and not yet applied to an invoice.` }] : []),
        ...(input.footer ? [{ heading: "Terms", body: input.footer }] : []),
    ]);

    doc.y = y;
    stampPageNumbers(doc, `${input.workshop.name} · statement for ${input.customer.name}`);
    return toBuffer(doc);
}
