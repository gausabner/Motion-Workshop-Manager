/**
 * Votes as the council's finance system exports them: one per line, the code,
 * its name, and the unit of the organisation it belongs to. Pure, so it can be
 * tested and the screen can show what will be imported before anything is.
 *
 * Accepts a comma or a semicolon (Excel writes one or the other depending on
 * the machine's region), quoted fields, and a header row if there is one.
 * Codes are kept exactly as written — leading zeros included — because the
 * nightly journal must post to the code the ERP knows.
 */

export type VoteRow = { line: number; code: string; name: string; unit: string };
export type VoteCsv = { rows: VoteRow[]; errors: { line: number; message: string }[] };

function split(line: string, sep: string): string[] {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') quoted = false;
            else cur += c;
        } else if (c === '"') quoted = true;
        else if (c === sep) { out.push(cur); cur = ""; }
        else cur += c;
    }
    out.push(cur);
    return out.map((f) => f.trim());
}

export function parseVoteCsv(text: string): VoteCsv {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/);
    const first = lines.find((l) => l.trim()) ?? "";
    const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows: VoteRow[] = [];
    const errors: { line: number; message: string }[] = [];
    const seen = new Map<string, number>();
    lines.forEach((raw, i) => {
        const line = i + 1;
        if (!raw.trim()) return;
        const [code = "", name = "", unit = ""] = split(raw, sep);
        if (rows.length === 0 && errors.length === 0 && /^(vote|code)/i.test(code) && /name|description/i.test(name)) return; // a header row
        if (!code) return void errors.push({ line, message: "No vote code." });
        if (!name) return void errors.push({ line, message: `Vote ${code} has no name.` });
        if (!unit) return void errors.push({ line, message: `Vote ${code} names no unit of the organisation.` });
        if (seen.has(code)) return void errors.push({ line, message: `Vote ${code} is already on line ${seen.get(code)}.` });
        seen.set(code, line);
        rows.push({ line, code, name, unit });
    });
    return { rows, errors };
}
