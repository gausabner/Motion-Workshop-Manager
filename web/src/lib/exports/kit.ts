import type { Column } from "@/lib/pdf/kit";
import type { Section } from "@/lib/pdf/register";
import { toCsv } from "@/lib/accounting/export";

/**
 * The shape every export shares, and the handful of formatters that keep them
 * from drifting apart.
 *
 * A report is defined once — as sections of columns and already-formatted
 * string cells — and rendered twice, as a PDF that gets filed and a CSV that
 * gets re-added. The rule that the two can never disagree is not kept by
 * discipline but by giving them no opportunity to.
 *
 * That has one visible consequence worth stating: money is written as a plain
 * decimal — `1150.00`, not `N$ 1,150.00` — with the currency named in the
 * column header. A spreadsheet can add the first and cannot add the second,
 * and a reader of the PDF loses nothing, because the header above the column
 * already says what the figures are in.
 *
 * Dates are ISO in every cell for the same reason. `01/02/2026` means two
 * different days depending on who opens the file, and these files pass from a
 * workshop to a council to an auditor.
 */

export type Register = {
    /** Used in the heading, the filename and the audit record. */
    title: string;
    sections: Section[];
    totals?: { label: string; value: string; strong?: boolean }[];
    notes?: string[];
    /** What the provenance block promises the file contains. */
    rows: number;
};

/** Two decimals, no separator, no symbol — a number a spreadsheet can add. */
export const dec = (n: number) => n.toFixed(2);

/** A whole number where a fraction would be noise: counts, quantities of one. */
export const int = (n: number) => String(Math.round(n));

export const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** An instant, in the workshop's own zone, for a cell that records when something happened. */
export const stamp = (d: Date, timeZone: string) =>
    d.toLocaleString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone }).replace(",", "");

/** Minutes as decimal hours, which is what a labour rate is quoted in. */
export const hours = (minutes: number) => (minutes / 60).toFixed(2);

export const percent = (n: number | null) => (n === null ? "" : `${n.toFixed(1)}%`);

export const col = (key: string, header: string, width: number, align?: Column["align"], muted?: boolean): Column =>
    ({ key, header, width, align, muted });

/** Every row of every section, which is what the provenance block counts. */
export const countRows = (sections: Section[]) => sections.reduce((total, s) => total + s.rows.length, 0);

/**
 * The same sections as a CSV.
 *
 * A report with more than one section becomes more than one block in the file,
 * each with its own heading line and its own header row, separated by a blank
 * line. That is not elegant, but it is what a bookkeeper's spreadsheet does
 * with a multi-part statement, and the alternative — one wide table with empty
 * columns — is worse to read and worse to sort.
 */
export function registerCsv(register: Register): string {
    return register.sections
        .map((section) => {
            // A spreadsheet is not an A4 page: where a section declares wider
            // columns for the CSV, they win here and the PDF keeps its own.
            const columns = section.csvColumns ?? section.columns;
            const header = columns.map((c) => c.header);
            const rows = section.rows.map((row) => columns.map((c) => row[c.key] ?? ""));
            const body = toCsv(header, rows);
            return section.heading ? `${toCsv([section.heading], [])}${body}` : body;
        })
        .join("\r\n");
}
