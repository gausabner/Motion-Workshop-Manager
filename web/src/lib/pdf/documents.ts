import "server-only";
import type { DocumentType } from "@prisma/client";
import { CONTENT_WIDTH, INK, MARGIN, PAGE, caption, createDocument, rule, stampPageNumbers, table, toBuffer, totals, type Column } from "@/lib/pdf/kit";
import { money as formatMoney } from "@/lib/format";
import { documentTitle } from "@/lib/templates/values";
import { drawLetterhead, drawNotes, drawParties, NOTES_WIDTH, type Letterhead } from "@/lib/pdf/letterhead";

/**
 * Quote, booking, job card, invoice, cash sale and credit note — one layout.
 *
 * They differ in their title, which notes they carry and whether they show an
 * amount due, and in nothing else. A workshop that sends a quote and then the
 * invoice for the same job should be sending the customer the same document
 * twice with a different word at the top.
 */

export type PdfLine = {
    itemCode: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    lineTotal: number;
    serialNumbers?: string | null;
};

export type DocumentPdfInput = {
    workshop: Letterhead;
    currency: string;
    type: DocumentType;
    number: string | null;
    jobNumber: string | null;
    state: string;
    postDate: string;
    dueDate: string | null;
    scheduledAt: string | null;
    reference: string | null;
    customerOrderNumber: string | null;
    customer: { name: string; lines: string[] } | null;
    vehicle: { plate: string; description: string; odometer: number | null; vin: string | null } | null;
    advisor: string | null;
    mechanic: string | null;
    lines: PdfLine[];
    taxName: string;
    taxRate: number;
    pricesIncludeTax: boolean;
    subtotal: number;
    discountApplied: number;
    freight: number;
    vatTotal: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    notes: string[];
    footer: string;
};

/** Only these put money on an account, so only these show what is still owed. */
const SETTLES = new Set<DocumentType>(["INVOICE", "CASH_SALE", "CREDIT"]);

export async function renderDocumentPdf(input: DocumentPdfInput): Promise<Buffer> {
    const money = (value: number) => formatMoney(value, input.currency);
    const title = documentTitle(input.type, input.workshop.vatNumber ?? null);
    const doc = createDocument(`${title} ${input.number ?? input.jobNumber ?? ""}`.trim());

    let y = drawLetterhead(doc, input.workshop, title, input.number ?? (input.jobNumber ? `Job ${input.jobNumber}` : "Draft"));

    if (input.state === "DRAFT") y = drawWatermarkNote(doc, y, "Draft — not yet posted. Figures may still change.");
    if (input.state === "VOID") y = drawWatermarkNote(doc, y, "Voided. This document has been reversed and is kept for the record only.", INK.danger);

    const meta: { label: string; value: string }[] = [{ label: "Date", value: input.postDate }];
    if (input.jobNumber) meta.push({ label: "Job number", value: input.jobNumber });
    if (input.scheduledAt) meta.push({ label: "Booked for", value: input.scheduledAt });
    if (input.dueDate && SETTLES.has(input.type)) meta.push({ label: "Due", value: input.dueDate });
    if (input.reference) meta.push({ label: "Reference", value: input.reference });
    if (input.customerOrderNumber) meta.push({ label: "Your order", value: input.customerOrderNumber });
    if (input.advisor) meta.push({ label: "Service advisor", value: input.advisor });
    if (input.mechanic) meta.push({ label: "Mechanic", value: input.mechanic });

    const parties = [
        { heading: "Billed to", lines: input.customer ? [input.customer.name, ...input.customer.lines] : ["Cash sale"] },
    ];
    if (input.vehicle) {
        parties.push({
            heading: "Vehicle",
            lines: [
                input.vehicle.plate,
                input.vehicle.description,
                input.vehicle.odometer !== null ? `${input.vehicle.odometer.toLocaleString("en-NA")} km` : "",
                input.vehicle.vin ? `VIN ${input.vehicle.vin}` : "",
            ].filter(Boolean),
        });
    }
    y = drawParties(doc, y, parties, meta);

    const columns: Column[] = [
        { key: "code", header: "Code", width: 62, muted: true },
        { key: "description", header: "Description", width: CONTENT_WIDTH - 62 - 44 - 74 - 40 - 82 },
        { key: "quantity", header: "Qty", width: 44, align: "right" },
        { key: "unitPrice", header: "Unit", width: 74, align: "right" },
        { key: "discount", header: "Disc", width: 40, align: "right" },
        { key: "amount", header: "Amount", width: 82, align: "right" },
    ];

    y = table(doc, y, {
        columns,
        rows: input.lines.map((line) => ({
            code: line.itemCode ?? "",
            description: line.serialNumbers ? `${line.description}\nSerial: ${line.serialNumbers}` : line.description,
            quantity: formatQuantity(line.quantity),
            unitPrice: money(line.unitPrice),
            discount: line.discountPercent ? `${line.discountPercent}%` : "",
            amount: money(line.lineTotal),
        })),
        onNewPage: (page) => drawLetterhead(page, input.workshop, title, input.number ?? ""),
    });

    y += 8;
    const totalLines: { label: string; value: string; strong?: boolean }[] = [
        { label: "Subtotal", value: money(input.subtotal) },
    ];
    if (input.discountApplied) totalLines.push({ label: "Discount", value: `− ${money(input.discountApplied)}` });
    if (input.freight) totalLines.push({ label: "Freight", value: money(input.freight) });
    totalLines.push({ label: `${input.taxName} (${input.taxRate}%)`, value: money(input.vatTotal) });
    totalLines.push({ label: "Total", value: money(input.total), strong: true });

    if (SETTLES.has(input.type) && input.state !== "DRAFT") {
        if (input.amountPaid) totalLines.push({ label: input.type === "CREDIT" ? "Applied" : "Paid", value: money(Math.abs(input.amountPaid)) });
        totalLines.push({ label: input.type === "CREDIT" ? "Credit remaining" : "Amount due", value: money(Math.abs(input.amountDue)), strong: true });
    }

    const afterTotals = totals(doc, y, totalLines);
    const notesBottom = drawNotes(doc, y, [
        ...input.notes.map((body) => ({ body })),
        ...(input.footer ? [{ heading: "Terms", body: input.footer }] : []),
    ], NOTES_WIDTH);

    doc.y = Math.max(afterTotals, notesBottom);
    stampPageNumbers(doc, `${input.workshop.name}${input.number ? ` · ${input.number}` : ""}`);
    return toBuffer(doc);
}

/** A banded note across the top, for a state the reader has to notice before the numbers. */
function drawWatermarkNote(doc: import("@/lib/pdf/kit").Doc, y: number, text: string, colour: string = INK.muted): number {
    doc.save().rect(MARGIN.left, y, CONTENT_WIDTH, 18).fill(colour === INK.danger ? "#fee2e2" : INK.band).restore();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(colour).text(text, MARGIN.left + 8, y + 5, { width: CONTENT_WIDTH - 16 });
    return y + 26;
}

/** Whole numbers lose the decimals; 2.5 hours keeps them. */
export function formatQuantity(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export { PAGE, MARGIN, CONTENT_WIDTH, caption, rule };
