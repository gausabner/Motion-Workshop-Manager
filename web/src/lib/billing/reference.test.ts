import { test } from "node:test";
import assert from "node:assert/strict";
import { newReference, normaliseReference, REFERENCE_PREFIX } from "@/lib/billing/reference";

/**
 * The reference is the only thing joining a line on a bank statement to a
 * workshop, and the match is made by a person reading both. So these tests are
 * about transcription rather than cryptography.
 */

test("a reference is short enough to survive a bank's reference field", () => {
    for (let i = 0; i < 50; i++) assert.ok(newReference().length <= 10, "references must fit in ten characters");
});

test("a reference is recognisable as ours at a glance on a statement", () => {
    assert.ok(newReference().startsWith(REFERENCE_PREFIX));
});

test("no character can be confused for another when read aloud or typed", () => {
    // 0/O, 1/I, 5/S and 8/B are the pairs people get wrong, in both
    // directions: reading a screen into online banking, and our own staff
    // reading a deposit slip back.
    const forbidden = /[0O1I5S8B]/;
    for (let i = 0; i < 300; i++) {
        const body = newReference().slice(REFERENCE_PREFIX.length);
        assert.ok(!forbidden.test(body), `generated an ambiguous reference: ${body}`);
    }
});

test("references do not repeat in any batch a human would ever see", () => {
    // Not a uniqueness proof — the unique index is that. This catches the
    // generator being broken in the obvious way, such as seeding once and
    // returning the same string forever.
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(newReference());
    assert.ok(seen.size > 995, `1000 references produced only ${seen.size} distinct values`);
});

test("references are not sequential, so nobody can count our customers or guess the next", () => {
    const bodies = Array.from({ length: 20 }, () => newReference().slice(REFERENCE_PREFIX.length));
    const sorted = [...bodies].sort();
    assert.notDeepEqual(bodies, sorted, "references came out in order, which would leak how many clients exist");
});

test("a reference written out by hand on a deposit slip is still accepted", () => {
    const ref = newReference();
    const body = ref.slice(REFERENCE_PREFIX.length);
    // Lower case, spaces instead of the dash, a stray dash in the middle: all
    // of these carry every character we need, so refusing them would be
    // perverse.
    assert.equal(normaliseReference(ref.toLowerCase()), ref);
    assert.equal(normaliseReference(`MOT ${body}`), ref);
    assert.equal(normaliseReference(`mot-${body.slice(0, 3)}-${body.slice(3)}`), ref);
    assert.equal(normaliseReference(`  ${ref}  `.replace(/\s/g, " ")), ref);
});

test("something that is not one of our references is refused rather than guessed at", () => {
    assert.equal(normaliseReference(""), null);
    assert.equal(normaliseReference("INV-123456"), null, "another system's reference");
    assert.equal(normaliseReference("MOT-12345"), null, "too short");
    assert.equal(normaliseReference("MOT-1234567"), null, "too long");
    // Contains characters the alphabet deliberately excludes, so it cannot be
    // one of ours and is more likely a misreading of one.
    assert.equal(normaliseReference("MOT-O0I1S5"), null);
});
