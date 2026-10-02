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
    /**
     * A section this line opens, printed as a banded row above it — "Parts",
     * "Labour". Set it on the first line of each run; repeating it on every
     * line of the same group prints the heading again.
     */
    groupHeading?: string | null;
    serialNumbers?: string | null;
    /** Printed indented, under the bundle it belongs to. */
    isBundleComponent?: boolean;
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
        // The supplier's quotation leads with a number, and a customer ringing
        // about one line says "number seven" rather than reading the
        // description back. It costs 22pt.
        { key: "no", header: "No.", width: 22, muted: true },
        { key: "code", header: "Code", width: 62, muted: true },
        { key: "description", header: "Description", width: CONTENT_WIDTH - 22 - 62 - 44 - 74 - 40 - 82 },
        { key: "quantity", header: "Qty", width: 44, align: "right" },
        { key: "unitPrice", header: "Unit", width: 74, align: "right" },
        { key: "discount", header: "Disc", width: 40, align: "right" },
        { key: "amount", header: "Amount", width: 82, align: "right" },
    ];

    // Numbered across the whole document, not within a section, and headings
    // take no number: a heading is not an item and cannot be ordered.
    let itemNumber = 0;
    let openGroup: string | null = null;

    y = table(doc, y, {
        columns,
        rows: input.lines.flatMap((line) => {
            const rows: import("@/lib/pdf/kit").TableRow[] = [];
            if (line.groupHeading && line.groupHeading !== openGroup) {
                openGroup = line.groupHeading;
                rows.push({ group: line.groupHeading });
            }
            itemNumber += 1;
            // What is inside a bundle is listed under it, without repeating money that the bundle line already carries.
            const included = line.isBundleComponent && line.lineTotal === 0;
            rows.push({
                no: line.isBundleComponent ? "" : String(itemNumber),
                code: line.isBundleComponent ? "" : line.itemCode ?? "",
                description: `${line.isBundleComponent ? "   · " : ""}${line.serialNumbers ? `${line.description}\nSerial: ${line.serialNumbers}` : line.description}`,
                quantity: formatQuantity(line.quantity),
                unitPrice: included ? "" : money(line.unitPrice),
                discount: line.discountPercent ? `${line.discountPercent}%` : "",
                amount: included ? "included" : money(line.lineTotal),
            });
            return rows;
        }),
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

    // A quote is an offer, and an offer wants somewhere to be accepted.
    //
    // Taken from the quotation this workshop's own supplier sends: three ruled
    // fields, name, signature and date. Without them a customer who agrees has
    // to say so in a separate message, which is the version nobody can produce
    // eighteen months later when the job is disputed. A printed line is the
    // cheapest contract there is.
    //
    // Quotes only. An invoice is not accepted, it is paid, and a signature
    // block on one invites somebody to sign instead of settling.
    if (input.type === "QUOTE") doc.y = drawAcceptance(doc, doc.y + 18);

    stampPageNumbers(doc, `${input.workshop.name}${input.number ? ` · ${input.number}` : ""}`);
    return toBuffer(doc);
}

/**
 * Where a quote is accepted: name, signature, date.
 *
 * Ruled lines rather than boxes, because this is printed or signed on a phone
 * screen with a finger, and a box implies a size the signature will not be.
 */
function drawAcceptance(doc: import("@/lib/pdf/kit").Doc, y: number): number {
    // A new page rather than a signature block split across the fold, which is
    // the one place a reader stops believing the document is whole.
    if (y > PAGE.height - MARGIN.bottom - 54) {
        doc.addPage();
        y = MARGIN.top;
    }

    rule(doc, y, INK.band);
    y += 10;
    doc.font("Helvetica").fontSize(7.5).fillColor(INK.muted).text("ACCEPTED BY", MARGIN.left, y, { characterSpacing: 0.6 });
    y = doc.y + 14;

    const fields: [string, number][] = [
        ["Name", 0.38],
        ["Signature", 0.34],
        ["Date", 0.28],
    ];
    let x = MARGIN.left;
    for (const [label, share] of fields) {
        const w = CONTENT_WIDTH * share - 12;
        doc.save().moveTo(x, y).lineTo(x + w, y).lineWidth(0.75).strokeColor(INK.rule).stroke().restore();
        doc.font("Helvetica").fontSize(7.5).fillColor(INK.muted).text(label, x, y + 4, { width: w });
        x += CONTENT_WIDTH * share;
    }
    return y + 20;
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
