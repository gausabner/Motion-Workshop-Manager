import { test } from "node:test";
import assert from "node:assert/strict";
import { ledgerBalances, ledgerFor, ledgerTotals, salesBatch, type LedgerAccounts, type LedgerInput } from "./ledger";
import { ledgerCsv, shapeHeaders } from "./shapes";

/**
 * The journal that goes out unattended.
 *
 * Everything else in the hand-off can fail loudly — a folder that is not
 * writable, a schedule that did not run — and somebody finds out. A journal
 * that is out by fifty cents does not fail: it imports, it posts, and it is
 * discovered in March by an accountant who bills for the afternoon. So the
 * balance is checked per batch as well as overall, and it is checked here
 * rather than only against a live database.
 */

const ACCOUNTS: LedgerAccounts = {
    debtors: "610", sales: "200", tax: "820",
    bank: "090", creditors: "800", purchases: "300", inputTax: "825",
};

const sale = (net: number, tax: number) => ({
    date: "2026-09-24", number: "INV-1", customer: "A", reference: null,
    description: "", net, tax, total: net + tax, dueDate: null,
});
const money = (amount: number) => ({ date: "2026-09-24", number: "RC-1", party: "A", reference: null, method: "Cash", amount });

const DAY = "2026-09-24";

test("every batch balances on its own, not just the file as a whole", () => {
    const input: LedgerInput = {
        sales: [sale(1000, 150), sale(500, 75)],
        receipts: [money(800)],
        purchases: [sale(400, 60)],
        supplierPayments: [money(250)],
    };
    const lines = ledgerFor(input, ACCOUNTS, DAY);
    const check = ledgerBalances(lines);
    assert.equal(check.ok, true);
    assert.equal(check.offBy, 0);
    assert.deepEqual(check.batches, []);
});

test("a file where two batches are wrong in opposite directions is still reported wrong", () => {
    // This is the shape a rounding mistake takes, and the reason the check is
    // per batch: the totals agree, so a whole-file check would pass it.
    const lines = [
        { date: DAY, reference: "A", account: "1", description: "", debit: 50, credit: 0 },
        { date: DAY, reference: "B", account: "2", description: "", debit: 0, credit: 50 },
    ];
    const check = ledgerBalances(lines);
    assert.equal(check.offBy, 0, "the totals agree");
    assert.equal(check.ok, false, "and it is still not a postable journal");
    assert.deepEqual(check.batches.map((b) => b.reference).sort(), ["A", "B"]);
});

test("a period of nothing produces no lines rather than a page of zeroes", () => {
    const lines = ledgerFor({ sales: [], receipts: [], purchases: [], supplierPayments: [] }, ACCOUNTS, DAY);
    assert.deepEqual(lines, []);
    assert.equal(ledgerBalances(lines).ok, true);
});

test("a day that was all credit notes posts as a negative batch, and still balances", () => {
    const lines = salesBatch([sale(-1000, -150)], ACCOUNTS, DAY);
    assert.equal(ledgerBalances(lines).ok, true);
    const debtors = lines.find((l) => l.account === "610");
    assert.equal(debtors?.debit, -1150, "what customers owe goes down");
});

test("a sale with no tax on it posts two lines, not a nil tax line an ERP has to be told to ignore", () => {
    const lines = salesBatch([sale(1000, 0)], ACCOUNTS, DAY);
    assert.equal(lines.length, 2);
    assert.equal(lines.some((l) => l.account === ACCOUNTS.tax), false);
    assert.equal(ledgerBalances(lines).ok, true);
});

test("the batch reference names the day, so a repeated import can be spotted from the other side", () => {
    const lines = salesBatch([sale(100, 15)], ACCOUNTS, DAY);
    assert.equal(lines[0].reference, "MOTION-SALES-2026-09-24");
    assert.ok(lines.every((l) => l.reference === lines[0].reference), "one batch, one reference");
});

test("tax rounds into the journal the way it rounds on the documents", () => {
    // Three lines that each round a third of a cent the same way: the total
    // must be the sum of what was actually charged, not a recalculation.
    const lines = salesBatch([sale(33.33, 5.0), sale(33.33, 5.0), sale(33.34, 5.0)], ACCOUNTS, DAY);
    const totals = ledgerTotals(lines);
    assert.equal(totals.debit, 115);
    assert.equal(totals.credit, 115);
    assert.equal(ledgerBalances(lines).ok, true);
});

// -- The shapes --------------------------------------------------------------

const LINES = ledgerFor(
    { sales: [sale(1000, 150)], receipts: [money(400)], purchases: [], supplierPayments: [] },
    ACCOUNTS, DAY,
);

test("every shape writes the same figures, whatever it calls the columns", () => {
    for (const shape of ["motion", "quickbooks", "sage", "xero"] as const) {
        const csv = ledgerCsv(LINES, shape);
        assert.ok(csv.includes("1150.00"), `${shape} carries the gross`);
        assert.ok(csv.includes("1000.00"), `${shape} carries the net`);
        assert.ok(csv.includes("150.00"), `${shape} carries the tax`);
        assert.equal(csv.split("\r\n").filter(Boolean).length, LINES.length + 1, `${shape} writes one row per line plus a header`);
    }
});

test("a shape that insists on day-first dates gets them, and the plain one keeps ISO", () => {
    assert.ok(ledgerCsv(LINES, "sage").includes("24/09/2026"));
    assert.ok(ledgerCsv(LINES, "quickbooks").includes("24/09/2026"));
    // ISO wherever a person might read it: 01/02/2026 is two different days
    // depending on who opens the file.
    assert.ok(ledgerCsv(LINES, "motion").includes("2026-09-24"));
    assert.ok(ledgerCsv(LINES, "xero").includes("2026-09-24"));
});

test("Xero takes one signed amount, because that is Xero's convention and not ours", () => {
    const csv = ledgerCsv(LINES, "xero");
    assert.ok(csv.includes("1150.00"), "the debit side positive");
    assert.ok(csv.includes("-1000.00"), "the credit side negative");
});

test("a shape's headers are stated, so a site can check them before the first live run", () => {
    assert.deepEqual(shapeHeaders("sage"), ["Reference", "Date", "AccountCode", "Description", "Debit", "Credit", "TaxType"]);
    assert.deepEqual(shapeHeaders("quickbooks")[0], "JournalNo");
});

test("an account code that looks like a formula cannot run in anybody's spreadsheet", () => {
    const csv = ledgerCsv(
        [{ date: DAY, reference: "R", account: "=cmd|' /c calc'!A1", description: "x", debit: 1, credit: 0 }],
        "motion",
    );
    assert.ok(csv.includes("'=cmd"), "defused with a leading apostrophe");
});
