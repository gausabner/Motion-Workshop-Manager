import { test } from "node:test";
import assert from "node:assert/strict";
import { csvField, exportFileName, journalBalances, journalCsv, plainSales, salesJournal, toCsv, xeroSales, type SaleRow } from "./export";

const sales: SaleRow[] = [
    { date: "2026-09-01", number: "INV-1001", customer: "Courtney Farrell", reference: null, description: "Minor service", net: 1000, tax: 150, total: 1150, dueDate: "2026-09-30" },
    { date: "2026-09-04", number: "CR-1001", customer: "Courtney Farrell", reference: "INV-1001", description: "Credit: wrong filter", net: -200, tax: -30, total: -230, dueDate: null },
];

test("a field is quoted only when it has to be", () => {
    assert.equal(csvField("plain"), "plain");
    assert.equal(csvField("has, comma"), '"has, comma"');
    assert.equal(csvField('say "hello"'), '"say ""hello"""');
    assert.equal(csvField("two\nlines"), '"two\nlines"');
    assert.equal(csvField(null), "");
    assert.equal(csvField(12.5), "12.5");
});

test("a field that would run as a formula is defused", () => {
    // Bookkeepers open these in Excel; =cmd is how a CSV becomes an attack.
    assert.equal(csvField("=1+1"), "'=1+1");
    assert.equal(csvField("+27 81 000"), "'+27 81 000");
    assert.equal(csvField("@SUM(A1)"), "'@SUM(A1)");
});

test("rows come out with CRLF line endings, which is what accounting packages expect", () => {
    const csv = toCsv(["A", "B"], [["1", "2"]]);
    assert.equal(csv, "A,B\r\n1,2\r\n");
});

test("a credit note stays negative all the way through", () => {
    const csv = plainSales(sales, "NAD");
    const lines = csv.trim().split("\r\n");
    assert.match(lines[0], /^Date,Number,Customer,Reference,Description,Net \(NAD\)/);
    assert.match(lines[2], /CR-1001/);
    assert.match(lines[2], /-200\.00,-30\.00,-230\.00/);
});

test("Xero gets its own columns in its own order", () => {
    const csv = xeroSales(sales, { salesAccount: "200", taxType: "Tax on Sales" });
    const [header, first] = csv.trim().split("\r\n");
    assert.equal(header, "ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,AccountCode,TaxType,TaxAmount");
    assert.equal(first, "Courtney Farrell,INV-1001,2026-09-01,2026-09-30,Minor service,1,1000.00,200,Tax on Sales,150.00");
});

test("an invoice with no due date falls back to its own date, which Xero requires", () => {
    const csv = xeroSales([sales[1]], { salesAccount: "200", taxType: "Tax on Sales" });
    assert.match(csv.trim().split("\r\n")[1], /^Courtney Farrell,CR-1001,2026-09-04,2026-09-04,/);
});

test("the journal balances, net of credits", () => {
    const journal = salesJournal(sales, { debtors: "610", sales: "200", tax: "820" });
    assert.deepEqual(journal, [
        { account: "610", debit: 920, credit: 0 },
        { account: "200", debit: 0, credit: 800 },
        { account: "820", debit: 0, credit: 120 },
    ]);
    assert.equal(journalBalances(journal), true);
    assert.match(journalCsv(journal, "NAD"), /^Account,Debit \(NAD\),Credit \(NAD\)/);
});

test("an empty period exports a header and nothing else, rather than failing", () => {
    assert.equal(plainSales([], "NAD").trim().split("\r\n").length, 1);
    assert.equal(journalBalances(salesJournal([], { debtors: "610", sales: "200", tax: "820" })), true);
});

test("the file name says what it is and when", () => {
    assert.equal(exportFileName("TipTop AutoCare", "sales", "2026-09-01", "2026-09-30"), "tiptop-autocare-sales-2026-09-01-to-2026-09-30.csv");
});
