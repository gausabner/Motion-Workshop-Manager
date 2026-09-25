import { test } from "node:test";
import assert from "node:assert/strict";
import { authorised, MIN_SECRET_LENGTH } from "./authorise";

/**
 * The lock on the door that opens at two in the morning.
 */

const SECRET = "a-secret-long-enough-to-be-one";

test("the right bearer token gets in", () => {
    assert.equal(authorised(`Bearer ${SECRET}`, SECRET), true);
});

test("no secret configured means the endpoint is off, not open", () => {
    // The failure that would never announce itself. Every other mistake here
    // produces a 401 somebody notices.
    for (const nothing of [undefined, "", "   "]) {
        assert.equal(authorised("Bearer anything", nothing), false, `secret: ${JSON.stringify(nothing)}`);
        assert.equal(authorised(null, nothing), false);
    }
});

test("a secret too short to be worth having is refused rather than used", () => {
    const short = "x".repeat(MIN_SECRET_LENGTH - 1);
    assert.equal(authorised(`Bearer ${short}`, short), false);
    assert.equal(authorised(`Bearer ${"x".repeat(MIN_SECRET_LENGTH)}`, "x".repeat(MIN_SECRET_LENGTH)), true);
});

test("a wrong token, a missing header and the wrong scheme are all refused", () => {
    assert.equal(authorised(`Bearer ${SECRET}x`, SECRET), false);
    assert.equal(authorised(`Bearer ${SECRET.slice(0, -1)}`, SECRET), false);
    assert.equal(authorised(null, SECRET), false);
    assert.equal(authorised("", SECRET), false);
    assert.equal(authorised(SECRET, SECRET), false, "the scheme is required");
    assert.equal(authorised(`Basic ${SECRET}`, SECRET), false);
});

test("a prefix of the secret does not get in, however long", () => {
    for (let i = 1; i < SECRET.length; i++) {
        assert.equal(authorised(`Bearer ${SECRET.slice(0, i)}`, SECRET), false);
    }
});

test("surrounding whitespace on the configured secret does not change what is accepted", () => {
    assert.equal(authorised(`Bearer ${SECRET}`, `  ${SECRET}  `), true);
});
