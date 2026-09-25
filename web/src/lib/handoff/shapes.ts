import { toCsv } from "@/lib/accounting/export";
import type { LedgerLine } from "@/lib/handoff/ledger";

/**
 * The same journal, in whichever column order the receiving system wants.
 *
 * Nothing here recalculates anything. Every shape is a projection of the same
 * `LedgerLine[]`, so a workshop that sends QuickBooks one month and Sage the
 * next sends the same figures — and a support call about a discrepancy can
 * never be answered with "which export did you use".
 *
 * The honest caveat, which the plan made in advance: the exact header a given
 * site wants depends on its version and on how its consultant set it up.
 * Sage Evolution's import layouts are defined per installation; QuickBooks
 * Online changed its journal columns between releases. So the headers live
 * here as data rather than being welded into a writer, and a per-deal
 * conversation changes a map rather than a module. What must never vary is
 * which figure goes under which meaning, and that is why the picks are named
 * after the meaning rather than after the column.
 */

export const LEDGER_SHAPES = ["motion", "quickbooks", "sage", "xero"] as const;
export type LedgerShapeName = (typeof LEDGER_SHAPES)[number];

export const SHAPE_LABELS: Record<LedgerShapeName, string> = {
    motion: "Plain",
    quickbooks: "QuickBooks",
    sage: "Sage Evolution",
    xero: "Xero",
};

export const SHAPE_NOTES: Record<LedgerShapeName, string> = {
    motion: "One line per side of every entry, with the batch reference. What a person reads when the import is argued about.",
    quickbooks: "QuickBooks' general journal columns. Every line of a batch carries the same journal number, which is how QuickBooks groups them into one entry.",
    sage: "Sage Evolution's GL journal columns, with debit and credit as separate amounts. Confirm the layout against the site's own import definition before the first live run.",
    xero: "Xero's manual journal columns. Amounts are signed on one column rather than split, which is Xero's own convention.",
};

type Column = { header: string; pick: (line: LedgerLine, index: number) => string };

const money = (n: number) => n.toFixed(2);
/** Blank rather than 0.00, because a zero in a debit column reads as a real entry. */
const side = (n: number) => (n === 0 ? "" : n.toFixed(2));

/**
 * `2026-09-24` as `24/09/2026`.
 *
 * Only ever used where the receiving system insists on it. MOTION writes ISO
 * everywhere a human might read the file, because `01/02/2026` is two
 * different days depending on who opens it — but an import that rejects ISO
 * rejects the whole file, and a rejected file helps nobody.
 */
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

const SHAPES: Record<LedgerShapeName, Column[]> = {
    motion: [
        { header: "Date", pick: (l) => l.date },
        { header: "Reference", pick: (l) => l.reference },
        { header: "Account", pick: (l) => l.account },
        { header: "Description", pick: (l) => l.description },
        { header: "Debit", pick: (l) => side(l.debit) },
        { header: "Credit", pick: (l) => side(l.credit) },
    ],
    quickbooks: [
        { header: "JournalNo", pick: (l) => l.reference },
        { header: "JournalDate", pick: (l) => dmy(l.date) },
        { header: "Account", pick: (l) => l.account },
        { header: "Debits", pick: (l) => side(l.debit) },
        { header: "Credits", pick: (l) => side(l.credit) },
        { header: "Description", pick: (l) => l.description },
        { header: "Name", pick: () => "" },
    ],
    sage: [
        { header: "Reference", pick: (l) => l.reference },
        { header: "Date", pick: (l) => dmy(l.date) },
        { header: "AccountCode", pick: (l) => l.account },
        { header: "Description", pick: (l) => l.description },
        { header: "Debit", pick: (l) => money(l.debit) },
        { header: "Credit", pick: (l) => money(l.credit) },
        { header: "TaxType", pick: () => "" },
    ],
    xero: [
        { header: "Narration", pick: (l) => l.description },
        { header: "Date", pick: (l) => l.date },
        { header: "Description", pick: (l) => l.reference },
        { header: "AccountCode", pick: (l) => l.account },
        // Xero takes one signed amount: a credit is a negative debit.
        { header: "Amount", pick: (l) => money(l.debit === 0 ? -l.credit : l.debit) },
        { header: "TaxRate", pick: () => "" },
    ],
};

export function ledgerCsv(lines: LedgerLine[], shape: LedgerShapeName): string {
    const columns = SHAPES[shape];
    return toCsv(columns.map((c) => c.header), lines.map((line, index) => columns.map((c) => c.pick(line, index))));
}

/** The columns a shape writes, for a screen that says what a site will receive. */
export const shapeHeaders = (shape: LedgerShapeName): string[] => SHAPES[shape].map((c) => c.header);
