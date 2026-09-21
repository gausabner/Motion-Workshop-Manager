import { test } from "node:test";
import assert from "node:assert/strict";
import { toInternational } from "./phone";

test("a Namibian number written the local way becomes international", () => {
    assert.equal(toInternational("081 744 4912"), "264817444912");
    assert.equal(toInternational("081-744-4912"), "264817444912");
});

test("a number already written internationally is left as it is", () => {
    assert.equal(toInternational("+264 81 744 4912"), "264817444912");
    assert.equal(toInternational("00264817444912"), "264817444912");
    assert.equal(toInternational("264817444912"), "264817444912");
});

test("the leading zero dropped still gets the country code", () => {
    assert.equal(toInternational("817444912"), "264817444912");
});

test("the workshop's country decides what a local number means", () => {
    assert.equal(toInternational("082 123 4567", "ZA"), "27821234567");
    assert.equal(toInternational("+27 82 123 4567", "NA"), "27821234567");
});

test("nothing usable gives nothing, rather than a link that fails", () => {
    assert.equal(toInternational(""), null);
    assert.equal(toInternational(null), null);
    assert.equal(toInternational("n/a"), null);
    assert.equal(toInternational("123"), null);
    assert.equal(toInternational("0812345", "XX"), null);
});
