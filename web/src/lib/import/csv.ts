/**
 * CSV, the way real files arrive: quoted fields with commas and newlines
 * inside them, doubled quotes, a byte-order mark from Excel, semicolons from
 * a European locale, and whatever line ending the exporting machine used.
 *
 * Small and dependency-free on purpose — an import that fails on somebody's
 * file is worse than no import, and this is the part that has to be right.
 */

export type Row = Record<string, string>;
export type Sheet = { headers: string[]; rows: Row[]; delimiter: string };

/** Commas unless the first line clearly prefers semicolons or tabs. */
export function sniffDelimiter(text: string): string {
    const line = text.split(/\r?\n/)[0] ?? "";
    const counts = [",", ";", "\t"].map((d) => [d, line.split(d).length - 1] as const);
    const best = counts.sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : ",";
}

/** Split into fields, honouring quotes. Returns rows of raw strings. */
export function parseCsv(text: string, delimiter?: string): string[][] {
    const body = text.replace(/^﻿/, "");
    const sep = delimiter ?? sniffDelimiter(body);
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < body.length; i++) {
        const char = body[i];
        if (quoted) {
            if (char === '"') {
                if (body[i + 1] === '"') { field += '"'; i++; }
                else quoted = false;
            } else field += char;
            continue;
        }
        if (char === '"') { quoted = true; continue; }
        if (char === sep) { row.push(field); field = ""; continue; }
        if (char === "\r") continue;
        if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
        field += char;
    }
    if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
    // A trailing newline leaves one empty row; a sheet of blank rows is nothing.
    return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** The first row is the column names, as the benchmark's importer also assumes. */
export function readSheet(text: string, delimiter?: string): Sheet {
    const sep = delimiter ?? sniffDelimiter(text.replace(/^﻿/, ""));
    const raw = parseCsv(text, sep);
    if (raw.length === 0) return { headers: [], rows: [], delimiter: sep };
    const headers = raw[0].map((h) => h.trim());
    const rows = raw.slice(1).map((cells) => {
        const row: Row = {};
        headers.forEach((header, i) => { row[header] = (cells[i] ?? "").trim(); });
        return row;
    });
    return { headers, rows, delimiter: sep };
}

/** Loose match for guessing which column is which: case, spaces and punctuation ignored. */
export function normaliseHeader(header: string): string {
    return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Guess a mapping from the file's headers to the fields we want. Each field
 * lists the names it is known by — including the ones Workshop Software
 * exports, which is what makes switching a morning's work rather than a
 * fortnight's typing.
 */
export function guessMapping(headers: string[], fields: { key: string; aliases: string[] }[]): Record<string, string> {
    const byNormalised = new Map(headers.map((h) => [normaliseHeader(h), h]));
    const mapping: Record<string, string> = {};
    const taken = new Set<string>();
    for (const field of fields) {
        for (const alias of [field.key, ...field.aliases]) {
            const header = byNormalised.get(normaliseHeader(alias));
            if (header && !taken.has(header)) {
                mapping[field.key] = header;
                taken.add(header);
                break;
            }
        }
    }
    return mapping;
}
