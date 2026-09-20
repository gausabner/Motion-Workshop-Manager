import { test } from "node:test";
import assert from "node:assert/strict";
import { guessMapping, normaliseHeader, parseCsv, readSheet, sniffDelimiter } from "./csv";

test("quoted fields keep their commas, newlines and doubled quotes", () => {
    const text = 'code,description\nA1,"Bolt, 8mm"\nA2,"He said ""fine"""\nA3,"Two\nlines"';
    assert.deepEqual(parseCsv(text), [
        ["code", "description"],
        ["A1", "Bolt, 8mm"],
        ["A2", 'He said "fine"'],
        ["A3", "Two\nlines"],
    ]);
});

test("a file from Excel — BOM, CRLF, trailing newline — reads cleanly", () => {
    const sheet = readSheet('﻿code,name\r\nA1,Anna\r\n\r\n');
    assert.deepEqual(sheet.headers, ["code", "name"]);
    assert.deepEqual(sheet.rows, [{ code: "A1", name: "Anna" }]);
});

test("semicolons and tabs are recognised without being told", () => {
    assert.equal(sniffDelimiter("a;b;c\n1;2;3"), ";");
    assert.equal(sniffDelimiter("a\tb\n1\t2"), "\t");
    assert.equal(sniffDelimiter("a,b\n1,2"), ",");
    assert.deepEqual(readSheet("a;b\n1;2").rows, [{ a: "1", b: "2" }]);
});

test("short rows fill with blanks rather than throwing the file out", () => {
    const sheet = readSheet("code,name,email\nA1,Anna\nA2,Ben,ben@example.com");
    assert.deepEqual(sheet.rows[0], { code: "A1", name: "Anna", email: "" });
    assert.deepEqual(sheet.rows[1].email, "ben@example.com");
});

test("headers are matched however they are punctuated", () => {
    assert.equal(normaliseHeader(" Item Code "), "itemcode");
    assert.equal(normaliseHeader("item_code"), "itemcode");
    const fields = [{ key: "itemCode", aliases: ["item code", "part number"] }, { key: "description", aliases: ["desc"] }];
    assert.deepEqual(guessMapping(["Item_Code", "DESC"], fields), { itemCode: "Item_Code", description: "DESC" });
    assert.deepEqual(guessMapping(["Part Number", "Notes"], fields), { itemCode: "Part Number" }, "what is not there is simply left unmapped");
});

test("one file column cannot fill two fields", () => {
    const fields = [{ key: "firstName", aliases: ["name"] }, { key: "lastName", aliases: ["name"] }];
    const mapping = guessMapping(["Name"], fields);
    assert.deepEqual(mapping, { firstName: "Name" });
});

test("an empty file is empty, not an error", () => {
    assert.deepEqual(readSheet(""), { headers: [], rows: [], delimiter: "," });
    assert.deepEqual(readSheet("\n\n").rows, []);
});
