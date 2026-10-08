import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultPrefix, nextError, NUMBERED, prefixError, sharedPrefixes } from "@/lib/documents/numbering-rules";

test("a prefix may be empty, or letters, digits and - / . starting with a letter or digit", () => {
    for (const ok of ["", "INV-", "TT/INV/", "2026-", "A.B", "inv-"]) assert.equal(prefixError(ok), null, ok);
    for (const bad of ["-INV", "IN V", "INV#", "INV_", "ÉCOLE-", "ABCDEFGHIJKLM"]) assert.ok(prefixError(bad), bad);
});

test("the next number is a whole number from 1 to nine digits", () => {
    assert.equal(nextError(1), null);
    assert.equal(nextError(999_999_999), null);
    for (const bad of [0, -5, 1.5, Number.NaN, 1_000_000_000]) assert.ok(nextError(bad), String(bad));
});

test("two series cannot share a prefix, whatever the case — including two with none", () => {
    assert.deepEqual([...sharedPrefixes({ INVOICE: "INV-", QUOTE: "Q-", CREDIT: "CR-" })], []);
    assert.deepEqual([...sharedPrefixes({ INVOICE: "INV-", QUOTE: "inv-" })].sort(), ["INVOICE", "QUOTE"]);
    assert.deepEqual([...sharedPrefixes({ INVOICE: "", QUOTE: "", CREDIT: "CR-" })].sort(), ["INVOICE", "QUOTE"]);
});

test("the defaults every new workshop starts with are all different", () => {
    const defaults = Object.fromEntries(NUMBERED.map(({ key }) => [key, defaultPrefix(key)]));
    assert.equal(sharedPrefixes(defaults).size, 0);
});
