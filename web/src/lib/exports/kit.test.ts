import { test } from "node:test";
import assert from "node:assert/strict";
import { registerCsv, type Register } from "./kit";

/**
 * The CSV half of "defined once, rendered twice".
 */

const register = (sections: Register["sections"]): Register => ({ title: "Test", rows: 0, sections });

test("a section with wider CSV columns gives the spreadsheet the extra ones, and the page keeps its own", () => {
    // The listings are the reason this exists: a customer list wants the
    // postal address in the file, and an A4 page fits seven columns before it
    // stops being readable. Both are still one definition over one set of
    // rows, which is the property worth keeping — a cell in both cannot
    // disagree with itself.
    const csv = registerCsv(register([{
        columns: [{ key: "name", header: "Customer", width: 100 }],
        csvColumns: [
            { key: "name", header: "Customer", width: 0 },
            { key: "city", header: "City", width: 0 },
        ],
        rows: [{ name: "Farrell", city: "Windhoek" }],
    }]));
    assert.ok(csv.includes("Customer,City"));
    assert.ok(csv.includes("Farrell,Windhoek"));
});

test("a section without them writes exactly what the page shows", () => {
    const csv = registerCsv(register([{
        columns: [{ key: "name", header: "Customer", width: 100 }],
        rows: [{ name: "Farrell", city: "Windhoek" }],
    }]));
    assert.ok(csv.includes("Customer"));
    assert.equal(csv.includes("Windhoek"), false, "a key with no column is not smuggled into the file");
});

test("each section becomes its own block, so a multi-part report stays sortable", () => {
    const csv = registerCsv(register([
        { heading: "By status", columns: [{ key: "a", header: "Status", width: 10 }], rows: [{ a: "Open" }] },
        { heading: "Every job", columns: [{ key: "b", header: "Job", width: 10 }], rows: [{ b: "JC-1" }] },
    ]));
    assert.ok(csv.indexOf("By status") < csv.indexOf("Status"));
    assert.ok(csv.indexOf("Status") < csv.indexOf("Every job"));
    assert.ok(csv.includes("\r\n"), "CRLF, because these are opened in Excel");
});

test("a missing cell is empty rather than the word undefined", () => {
    const csv = registerCsv(register([{
        columns: [{ key: "a", header: "A", width: 10 }, { key: "b", header: "B", width: 10 }],
        rows: [{ a: "one" }],
    }]));
    assert.ok(csv.includes("one,"));
    assert.equal(csv.includes("undefined"), false);
});
