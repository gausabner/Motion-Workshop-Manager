import "server-only";
import PDFDocument from "pdfkit";

/**
 * A small layer over PDFKit so every document the workshop sends out is laid
 * out by the same code — same margins, same rules, same table behaviour when a
 * job runs past one page.
 *
 * A4 in points: 595.28 × 841.89.
 */

export const PAGE = { width: 595.28, height: 841.89 } as const;
export const MARGIN = { top: 42, bottom: 56, left: 42, right: 42 } as const;
export const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;

export const INK = {
    text: "#1e293b",
    muted: "#64748b",
    faint: "#94a3b8",
    rule: "#cbd5e1",
    band: "#f1f5f9",
    accent: "#0f766e",
    danger: "#b91c1c",
} as const;

export type Doc = PDFKit.PDFDocument;

export function createDocument(title: string): Doc {
    return new PDFDocument({
        size: [PAGE.width, PAGE.height],
        margins: { ...MARGIN },
        bufferPages: true,
        info: { Title: title, Producer: "MOTION Workshop Manager", Creator: "MOTION Workshop Manager" },
    });
}

export function toBuffer(doc: Doc): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.end();
    });
}

export function rule(doc: Doc, y: number, colour: string = INK.rule, from: number = MARGIN.left, to: number = PAGE.width - MARGIN.right): void {
    doc.save().lineWidth(0.5).strokeColor(colour).moveTo(from, y).lineTo(to, y).stroke().restore();
}

/** A small uppercase caption above a value. */
export function caption(doc: Doc, text: string, x: number, y: number, width: number): number {
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(INK.faint).text(text.toUpperCase(), x, y, { width, characterSpacing: 0.6 });
    return doc.y;
}

export type Column = {
    key: string;
    header: string;
    width: number;
    align?: "left" | "right" | "center";
    /** Rendered in the lighter ink — for codes and notes that sit beside the real content. */
    muted?: boolean;
};

export type TableOptions = {
    columns: Column[];
    rows: Record<string, string>[];
    /** Drawn again at the top of every page the table runs onto. */
    repeatHeader?: boolean;
    zebra?: boolean;
    onNewPage?: (doc: Doc) => number;
};

const ROW_PADDING = 4;

/**
 * A table that knows what to do when it reaches the bottom of the page: break,
 * start a new one, and put its header back. Row height comes from the tallest
 * wrapped cell, so a long line description never overlaps the row beneath it.
 */
export function table(doc: Doc, startY: number, options: TableOptions): number {
    const { columns, rows, repeatHeader = true, zebra = true } = options;
    let y = startY;

    const drawHeader = (): void => {
        doc.font("Helvetica-Bold").fontSize(7).fillColor(INK.muted);
        let x = MARGIN.left;
        for (const column of columns) {
            doc.text(column.header.toUpperCase(), x, y + 3, { width: column.width, align: column.align ?? "left", characterSpacing: 0.4 });
            x += column.width;
        }
        y += 15;
        rule(doc, y);
        y += ROW_PADDING;
    };

    drawHeader();

    for (const [index, row] of rows.entries()) {
        doc.font("Helvetica").fontSize(8.5);
        const height = Math.max(
            ...columns.map((column) => doc.heightOfString(row[column.key] ?? "", { width: column.width - 6 })),
            11,
        );

        if (y + height + ROW_PADDING > PAGE.height - MARGIN.bottom) {
            doc.addPage();
            y = options.onNewPage ? options.onNewPage(doc) : MARGIN.top;
            if (repeatHeader) drawHeader();
        }

        if (zebra && index % 2 === 1) {
            doc.save().rect(MARGIN.left, y - ROW_PADDING + 1, CONTENT_WIDTH, height + ROW_PADDING * 2 - 2).fill(INK.band).restore();
        }

        let x = MARGIN.left;
        for (const column of columns) {
            doc.font("Helvetica").fontSize(8.5).fillColor(column.muted ? INK.muted : INK.text)
                .text(row[column.key] ?? "", x + 3, y, { width: column.width - 6, align: column.align ?? "left" });
            x += column.width;
        }
        y += height + ROW_PADDING * 2;
    }

    rule(doc, y - ROW_PADDING);
    return y;
}

/** The totals block: label on the left of the column, figure right-aligned under it. */
export function totals(doc: Doc, startY: number, lines: { label: string; value: string; strong?: boolean }[], width = 200): number {
    const x = PAGE.width - MARGIN.right - width;
    let y = startY;
    for (const line of lines) {
        const strong = line.strong === true;
        if (strong) {
            rule(doc, y - 3, INK.rule, x, PAGE.width - MARGIN.right);
            y += 2;
        }
        doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 10 : 8.5).fillColor(strong ? INK.text : INK.muted)
            .text(line.label, x, y, { width: width * 0.55 });
        doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 10 : 8.5).fillColor(INK.text)
            .text(line.value, x + width * 0.55, y, { width: width * 0.45, align: "right" });
        y += strong ? 16 : 13;
    }
    return y;
}

/**
 * Page numbers, written after the fact because the count is only known at the
 * end.
 *
 * The footer deliberately sits *below* the bottom margin, and pdfkit answers
 * text placed past the margin by flowing onto a fresh page — which is how a
 * one-line invoice ends up two pages long. Dropping the bottom margin for the
 * duration of the write is the documented way to say "this belongs here".
 */
export function stampPageNumbers(doc: Doc, note?: string): void {
    const range = doc.bufferedPageRange();
    if (range.count < 1) return;
    for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const y = PAGE.height - MARGIN.bottom + 20;
        doc.font("Helvetica").fontSize(7).fillColor(INK.faint);
        if (note) doc.text(note, MARGIN.left, y, { width: CONTENT_WIDTH * 0.7, lineBreak: false });
        if (range.count > 1) {
            doc.text(`Page ${i + 1} of ${range.count}`, MARGIN.left, y, { width: CONTENT_WIDTH, align: "right", lineBreak: false });
        }

        doc.page.margins.bottom = bottom;
    }
}
