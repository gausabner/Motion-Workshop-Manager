import { test } from "node:test";
import assert from "node:assert/strict";
import { describeAudience, EMPTY_FILTERS, filtersSchema, isEveryone, reachFor } from "./audience";

const person = (over: Partial<Parameters<typeof reachFor>[0]> = {}) => ({ mobile: "081 123 4567", email: "a@b.com", preferredContact: "WHATSAPP" as const, ...over });

test("an opted-out customer is never reachable, on any channel", () => {
    const out = person({ preferredContact: "OPT_OUT" });
    assert.deepEqual(reachFor(out, "WHATSAPP", false, "NA"), { ok: false, reason: "Opted out of messages" });
    assert.deepEqual(reachFor(out, "EMAIL", true, "NA"), { ok: false, reason: "Opted out of messages" });
});

test("the chosen channel is used, and its absence is explained", () => {
    assert.deepEqual(reachFor(person(), "WHATSAPP", false, "NA"), { ok: true, channel: "WHATSAPP", recipient: "264811234567" });
    assert.deepEqual(reachFor(person({ mobile: null }), "WHATSAPP", false, "NA"), { ok: false, reason: "No mobile number" });
    assert.deepEqual(reachFor(person({ mobile: "12" }), "WHATSAPP", false, "NA"), { ok: false, reason: "Mobile number WhatsApp cannot reach" });
    assert.deepEqual(reachFor(person({ email: "  " }), "EMAIL", false, "NA"), { ok: false, reason: "No email address" });
});

test("preferred contact wins, and the other channel is the fallback", () => {
    const emailFirst = reachFor(person({ preferredContact: "EMAIL" }), "WHATSAPP", true, "NA");
    assert.deepEqual(emailFirst, { ok: true, channel: "EMAIL", recipient: "a@b.com" });
    const noEmail = reachFor(person({ preferredContact: "EMAIL", email: null }), "EMAIL", true, "NA");
    assert.deepEqual(noEmail, { ok: true, channel: "WHATSAPP", recipient: "264811234567" }, "falls back to what they do have");
    const neither = reachFor(person({ mobile: null, email: null }), "EMAIL", true, "NA");
    assert.deepEqual(neither, { ok: false, reason: "No mobile number or email address" });
});

test("an audience with nothing set is everyone, and says so in words", () => {
    assert.equal(isEveryone(EMPTY_FILTERS), true);
    assert.equal(isEveryone({ ...EMPTY_FILTERS, owing: "owing" }), false);
    const names = new Map([["s1", "Referral – word of mouth"]]);
    assert.deepEqual(describeAudience({ ...EMPTY_FILTERS, sourceIds: ["s1"], area: "Windhoek", owing: "overdue", licenceWithinDays: 30 }, names), [
        "came to you through Referral – word of mouth", "in Windhoek", "more than 30 days overdue", "with a licence disc expiring within 30 days",
    ]);
});

test("filters are checked before they reach the database", () => {
    assert.equal(filtersSchema.safeParse({ lastInBefore: "20 Sept" }).success, false);
    assert.equal(filtersSchema.safeParse({ serviceDueWithinDays: 400 }).success, false);
    assert.equal(filtersSchema.safeParse({ lastInBefore: "", area: "  Windhoek " }).data?.area, "Windhoek");
});
