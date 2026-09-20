import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { amount, cursorArgs, DEFAULT_LIMIT, fail, json, MAX_LIMIT, page, paging, quantity } from "./http";

const at = (query: string) => new URL(`https://example.test/api/v1/customers${query}`);

test("limit is clamped rather than refused, because a caller asking for everything will page for it", () => {
    assert.equal(paging(at("")).limit, DEFAULT_LIMIT);
    assert.equal(paging(at("?limit=5")).limit, 5);
    assert.equal(paging(at("?limit=5000")).limit, MAX_LIMIT);
    assert.equal(paging(at("?limit=0")).limit, DEFAULT_LIMIT);
    assert.equal(paging(at("?limit=-3")).limit, DEFAULT_LIMIT);
    assert.equal(paging(at("?limit=abc")).limit, DEFAULT_LIMIT);
    assert.equal(paging(at("?limit=7.9")).limit, 7);
});

test("an empty cursor is no cursor", () => {
    assert.equal(paging(at("")).cursor, null);
    assert.equal(paging(at("?cursor=")).cursor, null);
    assert.equal(paging(at("?cursor=abc")).cursor, "abc");
});

test("paging hands back the last row's id only when another page exists", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(page(rows, 2), { data: [{ id: "a" }, { id: "b" }], nextCursor: "b" });
    assert.deepEqual(page(rows, 3), { data: rows, nextCursor: null });
    assert.deepEqual(page([], 10), { data: [], nextCursor: null });
});

test("a cursor resumes after itself, never repeating the row it names", () => {
    assert.deepEqual(cursorArgs(null, 10), { take: 11 });
    assert.deepEqual(cursorArgs("abc", 10), { take: 11, cursor: { id: "abc" }, skip: 1 });
});

test("money leaves as a fixed string, so nobody reads cents into a double", () => {
    assert.equal(amount(new Prisma.Decimal("1234.5")), "1234.50");
    assert.equal(amount(0), "0.00");
    assert.equal(amount(new Prisma.Decimal("-450.00")), "-450.00", "a credit note stays negative");
    assert.equal(amount(null), null);
    assert.equal(amount(undefined), null);
});

test("quantities keep their own precision and are not dressed up as money", () => {
    assert.equal(quantity(new Prisma.Decimal("2.5")), "2.5");
    assert.equal(quantity(new Prisma.Decimal("-1")), "-1", "a credit note's quantity is negative");
    assert.equal(quantity(null), null);
});

test("every error answers in one shape, with a code to branch on", async () => {
    const response = fail("invalid_request", "`type` must be one of QUOTE, INVOICE.", { field: "type" });
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), { error: { code: "invalid_request", message: "`type` must be one of QUOTE, INVOICE.", field: "type" } });

    const limited = fail("rate_limited", "Slow down.", { headers: { "retry-after": "30" } });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "30");
});

test("answers are JSON and never cached", async () => {
    const response = json({ data: [] });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(response.headers.get("cache-control"), "no-store");
});
