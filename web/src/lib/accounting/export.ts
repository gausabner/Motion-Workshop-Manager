import { round2 } from "@/lib/documents/totals";

/**
 * Handing the books to whoever keeps them.
 *
 * Three shapes, because that is what bookkeepers ask for: a plain list a
 * person can read, a file Xero will import, and a journal summary for anyone
 * who posts totals by hand. All three are built from the same rows, so they
 * cannot disagree with each other.
 */

export type ExportFormat = "plain" | "xero" | "journal";
export type ExportKind = "sales" | "receipts" | "purchases" | "supplierPayments";

export type SaleRow = {
    date: string;
    number: string;
    customer: string;
    reference: string | null;
    description: string;
    /** Excluding tax, signed: a credit note is negative. */
    net: number;
    tax: number;
    total: number;
    dueDate: string | null;
};

export type MoneyRow = {
    date: string;
    number: string;
    party: string;
    reference: string | null;
    method: string | null;
    amount: number;
};

/** A field as CSV: quoted when it has to be, and never able to start a formula. */
export function csvField(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    let text = String(value);
    // A leading =, + or @ makes a spreadsheet run it. Bookkeepers open these in Excel.
    if (/^[=+@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
    const lines = [headers.map(csvField).join(","), ...rows.map((row) => row.map(csvField).join(","))];
    return `${lines.join("\r\n")}\r\n`;
}

/** What a bookkeeper reads: one line per document, tax shown apart. */
export function plainSales(rows: SaleRow[], currency: string): string {
    return toCsv(
        ["Date", "Number", "Customer", "Reference", "Description", `Net (${currency})`, `Tax (${currency})`, `Total (${currency})`, "Due date"],
        rows.map((r) => [r.date, r.number, r.customer, r.reference, r.description, r.net.toFixed(2), r.tax.toFixed(2), r.total.toFixed(2), r.dueDate]),
    );
}

export function plainMoney(rows: MoneyRow[], currency: string, partyLabel: string): string {
    return toCsv(
        ["Date", "Number", partyLabel, "Reference", "How", `Amount (${currency})`],
        rows.map((r) => [r.date, r.number, r.party, r.reference, r.method, r.amount.toFixed(2)]),
    );
}

export type XeroSettings = { salesAccount: string; taxType: string };

/** Xero's own sales invoice import columns, in its order. */
export function xeroSales(rows: SaleRow[], settings: XeroSettings): string {
    return toCsv(
        ["ContactName", "InvoiceNumber", "InvoiceDate", "DueDate", "Description", "Quantity", "UnitAmount", "AccountCode", "TaxType", "TaxAmount"],
        rows.map((r) => [
            r.customer, r.number, r.date, r.dueDate ?? r.date, r.description || "Workshop services",
            "1", r.net.toFixed(2), settings.salesAccount, settings.taxType, r.tax.toFixed(2),
        ]),
    );
}

export type JournalLine = { account: string; debit: number; credit: number };

/**
 * The period as one journal: what was sold, the tax on it, and what it left
 * owing. Debits and credits balance, or the export is wrong and says so.
 */
export function salesJournal(rows: SaleRow[], accounts: { debtors: string; sales: string; tax: string }): JournalLine[] {
    const net = round2(rows.reduce((total, r) => total + r.net, 0));
    const tax = round2(rows.reduce((total, r) => total + r.tax, 0));
    const gross = round2(net + tax);
    return [
        { account: accounts.debtors, debit: gross, credit: 0 },
        { account: accounts.sales, debit: 0, credit: net },
        { account: accounts.tax, debit: 0, credit: tax },
    ];
}

export function journalBalances(lines: JournalLine[]): boolean {
    const debit = round2(lines.reduce((total, l) => total + l.debit, 0));
    const credit = round2(lines.reduce((total, l) => total + l.credit, 0));
    return debit === credit;
}

export function journalCsv(lines: JournalLine[], currency: string): string {
    return toCsv(
        ["Account", `Debit (${currency})`, `Credit (${currency})`],
        lines.filter((l) => l.debit !== 0 || l.credit !== 0).map((l) => [l.account, l.debit ? l.debit.toFixed(2) : "", l.credit ? l.credit.toFixed(2) : ""]),
    );
}

/** A file name a person can find again six months later. */
export function exportFileName(workshop: string, kind: ExportKind, from: string, to: string): string {
    const slug = workshop.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "workshop";
    return `${slug}-${kind}-${from}-to-${to}.csv`;
}
