import { test } from "node:test";
import assert from "node:assert/strict";
import { analyse, duplicatesWithin } from "./analyse";
import { parseDate, parseNumber } from "./entities";
import { readSheet } from "./csv";

test("dates arrive in whatever shape the old system wrote them", () => {
    assert.deepEqual(parseDate("2026-09-20"), { ok: true, value: new Date("2026-09-20T00:00:00Z") });
    assert.deepEqual(parseDate("20/09/2026"), { ok: true, value: new Date("2026-09-20T00:00:00Z") });
    assert.deepEqual(parseDate("20-09-26"), { ok: true, value: new Date("2026-09-20T00:00:00Z") });
    assert.deepEqual(parseDate(""), { ok: true, value: null });
    assert.deepEqual(parseDate("31/02/2026"), { ok: false }, "a day that does not exist is not a date");
    assert.deepEqual(parseDate("next tuesday"), { ok: false });
});

test("numbers arrive with currency symbols and thousands separators", () => {
    assert.deepEqual(parseNumber("1,250.50"), { ok: true, value: 1250.5 });
    assert.deepEqual(parseNumber("N$ 890"), { ok: true, value: 890 });
    assert.deepEqual(parseNumber("R1 200"), { ok: true, value: 1200 });
    assert.deepEqual(parseNumber(""), { ok: true, value: null });
    assert.deepEqual(parseNumber("about ten"), { ok: false });
});

test("a bad row is reported and the rest still import", () => {
    const sheet = readSheet("Code,Description,Cost\nA1,Widget,100\nA2,,50\n,Orphan,20\nA3,Gadget,not money");
    const result = analyse("products", sheet.headers, sheet.rows, { itemCode: "Code", description: "Description", costExTax: "Cost" });
    assert.equal(result.total, 4);
    assert.equal(result.ready.length, 1);
    assert.deepEqual(result.ready[0].values.itemCode, "A1");
    assert.deepEqual(result.problems.map((p) => p.line), [3, 4, 5], "lines are numbered as the workshop sees them in Excel");
    assert.match(result.problems[0].message, /Description is empty/);
    assert.match(result.problems[2].message, /not a number/);
});

test("columns nobody mapped are named, so nothing is dropped in silence", () => {
    const sheet = readSheet("Code,Description,Loyalty points\nA1,Widget,50");
    const result = analyse("products", sheet.headers, sheet.rows, { itemCode: "Code", description: "Description" });
    assert.deepEqual(result.ignoredColumns, ["Loyalty points"]);
    assert.deepEqual(result.missingRequired, []);
});

test("a file missing a required column says so before anything is read", () => {
    const sheet = readSheet("Description\nWidget");
    const result = analyse("products", sheet.headers, sheet.rows, { description: "Description" });
    assert.deepEqual(result.missingRequired, ["Item code"]);
});

test("a vehicle with no owner cannot be imported", () => {
    const sheet = readSheet("Rego,Make\nN12345W,Toyota");
    const result = analyse("vehicles", sheet.headers, sheet.rows, { plate: "Rego", make: "Make" });
    assert.equal(result.ready.length, 0);
    assert.match(result.problems[0].message, /No owner/);
});

test("the same record twice in one file is flagged, and the last one wins", () => {
    const sheet = readSheet("Code,Description\nA1,First\nA2,Other\nA1,Second");
    const result = analyse("products", sheet.headers, sheet.rows, { itemCode: "Code", description: "Description" });
    const dupes = duplicatesWithin("products", result.ready);
    assert.equal(dupes.length, 1);
    assert.match(dupes[0].message, /line 2 as well/);
});

test("customers are matched on email, or on name when there is none", () => {
    const sheet = readSheet("First,Last,Email\nAnna,Shilongo,anna@example.com\nAnna,Shilongo,\nAnna,Shilongo,");
    const result = analyse("customers", sheet.headers, sheet.rows, { firstName: "First", lastName: "Last", email: "Email" });
    const dupes = duplicatesWithin("customers", result.ready);
    assert.equal(dupes.length, 1, "the two without an email are the same person; the one with an email is its own record");
});
