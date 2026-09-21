import "server-only";
import { CONTENT_WIDTH, INK, createDocument, stampPageNumbers, table, toBuffer, totals, type Column } from "@/lib/pdf/kit";
import { money as formatMoney } from "@/lib/format";
import { drawLetterhead, drawNotes, drawParties, NOTES_WIDTH, type Letterhead } from "@/lib/pdf/letterhead";

/**
 * The receipt, and its mirror the refund.
 *
 * What a customer wants from a receipt is proof of three things: how much,
 * against what, and who took it. Everything here is one of those.
 */

export type ReceiptPdfInput = {
    workshop: Letterhead;
    currency: string;
    direction: "RECEIPT" | "REFUND";
    number: string | null;
    state: string;
    postDate: string;
    note: string | null;
    takenBy: string | null;
    customer: { name: string; lines: string[] } | null;
    tenders: { method: string; reference: string | null; amount: number; tendered: number | null }[];
    allocations: { label: string; number: string | null; date: string; amount: number }[];
    total: number;
    allocated: number;
    unapplied: number;
    accountBalance: number;
    footer: string;
};

export async function renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
    const money = (value: number) => formatMoney(Math.abs(value), input.currency);
    const isRefund = input.direction === "REFUND";
    const title = isRefund ? "Refund" : "Receipt";
    const doc = createDocument(`${title} ${input.number ?? ""}`.trim());

    let y = drawLetterhead(doc, input.workshop, title, input.number ?? "Draft");

    if (input.state === "VOID") {
        doc.save().rect(42, y, CONTENT_WIDTH, 18).fill("#fee2e2").restore();
        doc.font("Helvetica-Bold").fontSize(8).fillColor(INK.danger).text("Voided. This receipt has been reversed and anything it settled is open again.", 50, y + 5, { width: CONTENT_WIDTH - 16 });
        y += 26;
    }

    const meta = [{ label: "Date", value: input.postDate }];
    if (input.takenBy) meta.push({ label: isRefund ? "Paid out by" : "Taken by", value: input.takenBy });

    y = drawParties(doc, y, [{ heading: isRefund ? "Refunded to" : "Received from", lines: input.customer ? [input.customer.name, ...input.customer.lines] : ["—"] }], meta);

    const tenderColumns: Column[] = [
        { key: "method", header: isRefund ? "Paid out by" : "Method", width: 120 },
        { key: "reference", header: "Reference", width: CONTENT_WIDTH - 120 - 100 - 100, muted: true },
        { key: "received", header: "Received", width: 100, align: "right" },
        { key: "amount", header: isRefund ? "Paid out" : "Kept", width: 100, align: "right" },
    ];
    y = table(doc, y, {
        columns: tenderColumns,
        rows: input.tenders.map((tender) => ({
            method: tender.method,
            reference: tender.reference ?? "",
            received: tender.tendered ? money(tender.tendered) : "",
            amount: money(tender.amount),
        })),
    });

    // Change is only worth printing when there was some.
    const change = input.tenders.reduce((sum, t) => sum + Math.max(Math.abs(t.tendered ?? 0) - Math.abs(t.amount), 0), 0);

    if (input.allocations.length) {
        y += 14;
        y = table(doc, y, {
            columns: [
                { key: "label", header: "Applied to", width: 120 },
                { key: "number", header: "Number", width: 110 },
                { key: "date", header: "Date", width: CONTENT_WIDTH - 120 - 110 - 110, muted: true },
                { key: "amount", header: "Amount", width: 110, align: "right" },
            ],
            rows: input.allocations.map((allocation) => ({
                label: allocation.label,
                number: allocation.number ?? "",
                date: allocation.date,
                amount: `${allocation.amount < 0 ? "− " : ""}${money(allocation.amount)}`,
            })),
        });
    }

    y += 10;
    const lines: { label: string; value: string; strong?: boolean }[] = [
        { label: isRefund ? "Paid out" : "Received", value: money(input.total) },
    ];
    if (change > 0) lines.push({ label: "Change given", value: money(change) });
    lines.push({ label: isRefund ? "Against credit notes" : "Applied", value: money(input.allocated) });
    if (Math.abs(input.unapplied) > 0) {
        lines.push({ label: isRefund ? "From credit on account" : "Left on account", value: money(input.unapplied) });
    }
    lines.push({ label: "Account balance", value: money(input.accountBalance), strong: true });

    const afterTotals = totals(doc, y, lines);
    const notesBottom = drawNotes(doc, y, [
        ...(input.note ? [{ heading: "Note", body: input.note }] : []),
        ...(input.footer ? [{ heading: "Terms", body: input.footer }] : []),
    ], NOTES_WIDTH);

    doc.y = Math.max(afterTotals, notesBottom);
    stampPageNumbers(doc, `${input.workshop.name}${input.number ? ` · ${input.number}` : ""}`);
    return toBuffer(doc);
}
