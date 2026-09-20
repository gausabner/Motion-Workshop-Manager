import { test } from "node:test";
import assert from "node:assert/strict";
import { bearerToken, hashApiKey, hashesMatch, hasScope, KEY_PREFIX, keyPrefix, mintApiKey, retryAfter, windowHasRolled } from "./keys";

process.env.SESSION_SECRET ??= "test-secret-at-least-16-chars";

test("a minted key is readable at its head and unrecoverable from what we store", () => {
    const key = mintApiKey();
    assert.ok(key.token.startsWith(KEY_PREFIX));
    assert.equal(key.prefix.length, KEY_PREFIX.length + 4);
    assert.ok(key.token.startsWith(key.prefix));
    // The stored hash must not contain the secret it came from.
    assert.ok(!key.tokenHash.includes(key.token.slice(KEY_PREFIX.length)));
    assert.equal(key.tokenHash, hashApiKey(key.token));
    assert.notEqual(mintApiKey().token, key.token);
});

test("only a bearer token of our own shape gets as far as the database", () => {
    const { token } = mintApiKey();
    assert.equal(bearerToken(`Bearer ${token}`), token);
    assert.equal(bearerToken(`bearer ${token}`), token);
    assert.equal(bearerToken(null), null);
    assert.equal(bearerToken("Basic abc"), null);
    assert.equal(bearerToken("Bearer"), null);
    assert.equal(bearerToken("Bearer sk_live_somethingelse"), null, "another vendor's key shape");
    assert.equal(bearerToken(`Bearer ${KEY_PREFIX}short`), null, "too short to be one of ours");
    assert.equal(bearerToken(`Bearer ${KEY_PREFIX}${"x".repeat(400)}`), null, "absurdly long");
});

test("hashes compare without leaking how far they matched", () => {
    const a = hashApiKey("mk_live_one");
    assert.ok(hashesMatch(a, hashApiKey("mk_live_one")));
    assert.ok(!hashesMatch(a, hashApiKey("mk_live_two")));
    assert.ok(!hashesMatch(a, "short"), "different lengths must not throw");
});

test("a read key cannot write", () => {
    assert.ok(hasScope(["READ"], "READ"));
    assert.ok(!hasScope(["READ"], "WRITE"));
    assert.ok(hasScope(["READ", "WRITE"], "WRITE"));
});

test("the rate window rolls on the minute, and says how long to wait", () => {
    const start = new Date("2026-09-20T10:00:00Z");
    assert.equal(windowHasRolled(start, new Date("2026-09-20T10:00:30Z")), false);
    assert.equal(windowHasRolled(start, new Date("2026-09-20T10:01:00Z")), true);
    assert.equal(retryAfter(start, new Date("2026-09-20T10:00:30Z")), 30);
    assert.equal(retryAfter(start, new Date("2026-09-20T10:00:59.5Z")), 1, "never says wait zero seconds");
});

test("the prefix shown in the list is not enough to use", () => {
    const shown = keyPrefix("mk_live_7Qa3xxxxxxxxxxxxxxxxxxxx");
    assert.equal(shown, "mk_live_7Qa3");
    assert.ok(!hashesMatch(hashApiKey(shown), hashApiKey("mk_live_7Qa3xxxxxxxxxxxxxxxxxxxx")));
});
