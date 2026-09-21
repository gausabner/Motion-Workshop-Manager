import "server-only";
import { CONTENT_WIDTH, INK, MARGIN, PAGE, caption, rule, type Doc } from "@/lib/pdf/kit";

/**
 * The top and bottom of every document that leaves the workshop.
 *
 * One implementation, so a quote, an invoice, a receipt and a statement are
 * recognisably the same business — which is most of what "branded" means to a
 * customer who receives two of them a year.
 */

export type Letterhead = {
    name: string;
    registrationNumber?: string | null;
    vatNumber?: string | null;
    addressLines: string[];
    phone?: string | null;
    email?: string | null;
    web?: string | null;
    logo?: Buffer | null;
    taxName: string;
};

export type PartyBlock = { heading: string; lines: string[] };

export type Meta = { label: string; value: string }[];

const LOGO = { width: 118, height: 46 } as const;

export function drawLetterhead(doc: Doc, workshop: Letterhead, title: string, subtitle?: string): number {
    const right = PAGE.width - MARGIN.right;
    let leftY: number = MARGIN.top;

    if (workshop.logo) {
        try {
            doc.image(workshop.logo, MARGIN.left, leftY, { fit: [LOGO.width, LOGO.height] });
            leftY += LOGO.height + 6;
        } catch {
            // A logo that will not decode must never stop an invoice printing.
        }
    }

    doc.font("Helvetica-Bold").fontSize(workshop.logo ? 10 : 15).fillColor(INK.text).text(workshop.name, MARGIN.left, leftY, { width: CONTENT_WIDTH * 0.55 });
    leftY = doc.y + 2;

    const details = [
        ...workshop.addressLines,
        [workshop.phone, workshop.email].filter(Boolean).join("  ·  "),
        workshop.web ?? "",
        [workshop.vatNumber ? `${workshop.taxName} ${workshop.vatNumber}` : "", workshop.registrationNumber ? `Reg ${workshop.registrationNumber}` : ""].filter(Boolean).join("  ·  "),
    ].filter((line) => line.trim().length > 0);

    doc.font("Helvetica").fontSize(8).fillColor(INK.muted);
    for (const line of details) {
        doc.text(line, MARGIN.left, leftY, { width: CONTENT_WIDTH * 0.55 });
        leftY = doc.y;
    }

    // Title block, right-aligned, so the eye finds "TAX INVOICE" before anything else.
    doc.font("Helvetica-Bold").fontSize(19).fillColor(INK.text).text(title.toUpperCase(), right - 240, MARGIN.top, { width: 240, align: "right", characterSpacing: 0.5 });
    let rightY = doc.y;
    if (subtitle) {
        doc.font("Helvetica").fontSize(9).fillColor(INK.muted).text(subtitle, right - 240, rightY + 1, { width: 240, align: "right" });
        rightY = doc.y;
    }

    const y = Math.max(leftY, rightY) + 10;
    rule(doc, y, INK.accent);
    return y + 12;
}

/**
 * Who it is for, and the handful of facts about it — side by side, because
 * that is where a customer's eye goes to check it is really their car.
 */
export function drawParties(doc: Doc, startY: number, parties: PartyBlock[], meta: Meta): number {
    const metaWidth = 210;
    const partyWidth = (CONTENT_WIDTH - metaWidth - 16) / Math.max(parties.length, 1);
    let bottom = startY;

    parties.forEach((party, index) => {
        const x = MARGIN.left + index * partyWidth;
        let y = caption(doc, party.heading, x, startY, partyWidth - 10) + 2;
        doc.font("Helvetica").fontSize(8.5).fillColor(INK.text);
        for (const [lineIndex, line] of party.lines.entries()) {
            if (!line) continue;
            doc.font(lineIndex === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(lineIndex === 0 ? 9.5 : 8.5).fillColor(lineIndex === 0 ? INK.text : INK.muted);
            doc.text(line, x, y, { width: partyWidth - 10 });
            y = doc.y;
        }
        bottom = Math.max(bottom, y);
    });

    // The meta column is a two-column grid so labels and values stay aligned.
    const metaX = PAGE.width - MARGIN.right - metaWidth;
    let metaY = startY;
    for (const item of meta) {
        doc.font("Helvetica").fontSize(8).fillColor(INK.muted).text(item.label, metaX, metaY, { width: metaWidth * 0.45 });
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK.text).text(item.value, metaX + metaWidth * 0.45, metaY, { width: metaWidth * 0.55, align: "right" });
        metaY += 13;
    }

    return Math.max(bottom, metaY) + 12;
}

/**
 * Free text under the table: terms, banking details, the workshop's own note.
 *
 * `width` is not decoration — notes sit beside the totals column, and anything
 * wider than the gap prints straight through the figures.
 */
export function drawNotes(doc: Doc, startY: number, blocks: { heading?: string; body: string }[], width = CONTENT_WIDTH): number {
    let y = startY;
    for (const block of blocks) {
        if (!block.body.trim()) continue;
        if (y > PAGE.height - MARGIN.bottom - 60) {
            doc.addPage();
            y = MARGIN.top;
        }
        if (block.heading) y = caption(doc, block.heading, MARGIN.left, y, width) + 2;
        doc.font("Helvetica").fontSize(8).fillColor(INK.muted).text(block.body, MARGIN.left, y, { width, lineGap: 1 });
        y = doc.y + 10;
    }
    return y;
}

/** How much room notes have before the totals column starts. */
export const NOTES_WIDTH = CONTENT_WIDTH - 220;
