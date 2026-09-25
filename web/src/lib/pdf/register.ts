import "server-only";
import { CONTENT_WIDTH, INK, MARGIN, caption, createDocument, rule, stampPageNumbers, table, toBuffer, totals, type Column } from "@/lib/pdf/kit";
import { drawLetterhead, type Letterhead } from "@/lib/pdf/letterhead";
import { pdfFootNote, periodPhrase, type Provenance } from "@/lib/exports/provenance";

/**
 * A register: the form of a report that gets filed rather than read.
 *
 * Six of the phase-one exports are the same document with different columns —
 * a heading on the workshop's letterhead, one numbered row per record, a
 * totals block, and a footer on every page saying who produced it and when.
 * Writing six of those separately is how they drift apart, and two reports
 * that disagree about the same period is precisely the discrepancy an auditor
 * stops on. So there is one renderer.
 *
 * Portrait, not landscape. The temptation with a register is to turn the page
 * sideways and fit more columns, but every one of these fits in six or seven,
 * and a filed report that matches the orientation of every other document the
 * workshop produces is worth more than two extra columns.
 *
 * The row cap is deliberate and visible. A PDF of forty thousand audit events
 * is not a document anybody reads — it is a way of running the server out of
 * memory. Past the cap the file says plainly how many rows it is showing and
 * where the whole thing lives, which is the CSV.
 */

export const PDF_ROW_CAP = 2_500;

/**
 * Characters the built-in PDF fonts cannot draw.
 *
 * PDFKit's Helvetica is WinAnsi-encoded, which covers everything in Latin-1 —
 * every accented name a Namibian workshop will type — but not arrows. An
 * arrow in a status change rendered as two stray glyphs (`!'`), which is the
 * kind of defect that is invisible until somebody files the page.
 *
 * Only the substitution is done here rather than in the report itself, so the
 * screen and the CSV keep the arrow they should have. The figures are
 * identical either way; this is the shape of one character.
 */
const UNPRINTABLE: [RegExp, string][] = [
    [/[\u2192\u27f6\u21d2]/g, "\u00bb"],
    [/[\u2190\u27f5\u21d0]/g, "\u00ab"],
    [/[\u2713\u2714]/g, "Y"],
    [/[\u2717\u2718\u00d7]/g, "x"],
    [/[\u2264]/g, "<="],
    [/[\u2265]/g, ">="],
];

function printable(text: string): string {
    return UNPRINTABLE.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

export type Section = {
    heading?: string;
    columns: Column[];
    /**
     * The columns the CSV writes, when a spreadsheet should carry more than a
     * page can hold.
     *
     * A listing of six hundred customers wants the postal address and the
     * account number in it; an A4 page fits seven columns before it becomes
     * unreadable. Rather than choose — or turn the page sideways and lose the
     * argument for a filed document that matches every other one the workshop
     * prints — the section declares both, over the same rows. The two are
     * still one definition of one report, which is the property worth keeping:
     * a cell that appears in both cannot disagree with itself.
     */
    csvColumns?: Column[];
    rows: Record<string, string>[];
    /** Shown when the section has nothing in it, instead of an empty grid. */
    empty?: string;
};

export type RegisterInput = {
    workshop: Letterhead;
    provenance: Provenance;
    sections: Section[];
    totals?: { label: string; value: string; strong?: boolean }[];
    /** A finding, a caveat, a count that did not fit anywhere else. */
    notes?: string[];
};

export async function renderRegisterPdf(input: RegisterInput): Promise<Buffer> {
    const { workshop, provenance, sections } = input;
    const doc = createDocument(`${provenance.title} — ${workshop.name}`);

    let y = drawLetterhead(doc, workshop, provenance.title, periodPhrase(provenance));

    for (const section of sections) {
        if (section.heading) {
            if (y > doc.page.height - MARGIN.bottom - 80) {
                doc.addPage();
                y = MARGIN.top;
            }
            y = caption(doc, section.heading, MARGIN.left, y, CONTENT_WIDTH) + 4;
        }

        if (section.rows.length === 0) {
            doc.font("Helvetica").fontSize(9).fillColor(INK.muted).text(section.empty ?? "Nothing in this period.", MARGIN.left, y, { width: CONTENT_WIDTH });
            y = doc.y + 14;
            continue;
        }

        const shown = section.rows
            .slice(0, PDF_ROW_CAP)
            .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, printable(value)])));
        y = table(doc, y, { columns: section.columns, rows: shown, onNewPage: () => MARGIN.top }) + 6;

        if (section.rows.length > shown.length) {
            doc.font("Helvetica-Bold").fontSize(8).fillColor(INK.danger)
                .text(
                    `Showing the first ${shown.length.toLocaleString("en-GB")} of ${section.rows.length.toLocaleString("en-GB")} rows. Download the CSV for the whole period.`,
                    MARGIN.left, y, { width: CONTENT_WIDTH },
                );
            y = doc.y + 10;
        }
    }

    if (input.totals && input.totals.length > 0) {
        if (y > doc.page.height - MARGIN.bottom - 90) {
            doc.addPage();
            y = MARGIN.top;
        }
        y = totals(doc, y + 4, input.totals) + 8;
    }

    for (const note of input.notes ?? []) {
        if (y > doc.page.height - MARGIN.bottom - 40) {
            doc.addPage();
            y = MARGIN.top;
        }
        doc.font("Helvetica").fontSize(8).fillColor(INK.muted).text(note, MARGIN.left, y, { width: CONTENT_WIDTH, lineGap: 1 });
        y = doc.y + 6;
    }

    rule(doc, y + 2);
    stampPageNumbers(doc, pdfFootNote(provenance));
    return toBuffer(doc);
}
