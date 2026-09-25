import { round2 } from "@/lib/documents/totals";
import type { MoneyRow, SaleRow } from "@/lib/accounting/export";

/**
 * A period's books as journal lines an accounting package can post.
 *
 * The existing journal export is three aggregate lines for sales — enough for
 * a bookkeeper typing totals in by hand, and not enough for a machine, which
 * wants a date, a reference it can find again, and the other side of every
 * entry. So this is the same arithmetic carried further: sales, the money that
 * came in against them, purchases, and the money that went out.
 *
 * Every batch carries a reference of its own — `MOTION-SALES-2026-09-24` — and
 * that reference is what makes the hand-off safe to repeat. An ERP asked to
 * import the same reference twice will either refuse or overwrite, and either
 * is better than posting the day twice. It is the only protection that works
 * from our side of a one-way drop, because once the file is in the folder we
 * have no idea what happens to it.
 *
 * Nothing here touches the database. A journal that can be built from rows in
 * memory can be tested for balance without one, and a journal that does not
 * balance is the single defect this whole hand-off exists to avoid.
 */

export type LedgerLine = {
    /** The day the batch is posted to, ISO. */
    date: string;
    reference: string;
    account: string;
    description: string;
    debit: number;
    credit: number;
};

/** Where each side of each entry lands in the buyer's chart of accounts. */
export type LedgerAccounts = {
    debtors: string;
    sales: string;
    tax: string;
    bank: string;
    creditors: string;
    purchases: string;
    inputTax: string;
};

const sum = (values: number[]) => round2(values.reduce((total, v) => total + v, 0));

/**
 * One batch: a debit side and a credit side that already agree.
 *
 * Lines worth nothing are dropped rather than written as zeroes. A period with
 * no tax on it should not post a nil tax line an ERP then has to be told to
 * ignore, and dropping them cannot unbalance anything because nil is nil on
 * both sides.
 */
function batch(date: string, reference: string, lines: { account: string; description: string; debit?: number; credit?: number }[]): LedgerLine[] {
    return lines
        .map((l) => ({ date, reference, account: l.account, description: l.description, debit: round2(l.debit ?? 0), credit: round2(l.credit ?? 0) }))
        .filter((l) => l.debit !== 0 || l.credit !== 0);
}

/**
 * Sales for the period: what customers now owe, split into revenue and the tax
 * that was charged on it.
 *
 * Credit notes are already stored as the sale run backwards, so they subtract
 * themselves and a period that was all credits posts as a negative batch
 * rather than needing a second, opposite one.
 */
export function salesBatch(rows: SaleRow[], accounts: LedgerAccounts, date: string): LedgerLine[] {
    const net = sum(rows.map((r) => r.net));
    const tax = sum(rows.map((r) => r.tax));
    return batch(date, `MOTION-SALES-${date}`, [
        { account: accounts.debtors, description: "Workshop sales", debit: round2(net + tax) },
        { account: accounts.sales, description: "Workshop sales", credit: net },
        { account: accounts.tax, description: "Output tax on sales", credit: tax },
    ]);
}

/** Money received: the bank goes up, what customers owe comes down. */
export function receiptsBatch(rows: MoneyRow[], accounts: LedgerAccounts, date: string): LedgerLine[] {
    const taken = sum(rows.map((r) => r.amount));
    return batch(date, `MOTION-RECEIPTS-${date}`, [
        { account: accounts.bank, description: "Receipts from customers", debit: taken },
        { account: accounts.debtors, description: "Receipts from customers", credit: taken },
    ]);
}

/** Supplier invoices: stock and expenses go up, and so does what the workshop owes. */
export function purchasesBatch(rows: SaleRow[], accounts: LedgerAccounts, date: string): LedgerLine[] {
    const net = sum(rows.map((r) => r.net));
    const tax = sum(rows.map((r) => r.tax));
    return batch(date, `MOTION-PURCHASES-${date}`, [
        { account: accounts.purchases, description: "Supplier invoices", debit: net },
        { account: accounts.inputTax, description: "Input tax on purchases", debit: tax },
        { account: accounts.creditors, description: "Supplier invoices", credit: round2(net + tax) },
    ]);
}

/** Money paid out: what the workshop owes comes down, and so does the bank. */
export function supplierPaymentsBatch(rows: MoneyRow[], accounts: LedgerAccounts, date: string): LedgerLine[] {
    const paid = sum(rows.map((r) => r.amount));
    return batch(date, `MOTION-PAYMENTS-${date}`, [
        { account: accounts.creditors, description: "Payments to suppliers", debit: paid },
        { account: accounts.bank, description: "Payments to suppliers", credit: paid },
    ]);
}

export type LedgerInput = {
    sales: SaleRow[];
    receipts: MoneyRow[];
    purchases: SaleRow[];
    supplierPayments: MoneyRow[];
};

/** The whole period, in the order a person reading the file would expect. */
export function ledgerFor(input: LedgerInput, accounts: LedgerAccounts, date: string): LedgerLine[] {
    return [
        ...salesBatch(input.sales, accounts, date),
        ...receiptsBatch(input.receipts, accounts, date),
        ...purchasesBatch(input.purchases, accounts, date),
        ...supplierPaymentsBatch(input.supplierPayments, accounts, date),
    ];
}

/**
 * Whether the journal balances, batch by batch as well as overall.
 *
 * Checking only the total would pass a file where sales were out by fifty and
 * purchases were out by fifty the other way — which is exactly the shape a
 * rounding mistake takes, and exactly the file an ERP accepts and an
 * accountant spends a day on in March.
 */
export function ledgerBalances(lines: LedgerLine[]): { ok: boolean; offBy: number; batches: { reference: string; offBy: number }[] } {
    const byReference = new Map<string, number>();
    for (const l of lines) byReference.set(l.reference, round2((byReference.get(l.reference) ?? 0) + l.debit - l.credit));
    const batches = [...byReference.entries()].map(([reference, offBy]) => ({ reference, offBy })).filter((b) => b.offBy !== 0);
    const offBy = round2(sum(lines.map((l) => l.debit)) - sum(lines.map((l) => l.credit)));
    return { ok: offBy === 0 && batches.length === 0, offBy, batches };
}

export const ledgerTotals = (lines: LedgerLine[]) => ({
    debit: sum(lines.map((l) => l.debit)),
    credit: sum(lines.map((l) => l.credit)),
});
