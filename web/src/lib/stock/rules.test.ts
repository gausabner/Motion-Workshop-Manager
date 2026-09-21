import { test } from "node:test";
import assert from "node:assert/strict";
import { marginByLineType, marginOf, missingCost, movesStock, postsStock, type MarginLine } from "./rules";

const product = (over: object = {}) => ({ type: "STOCK" as const, isService: false, dontUpdateQty: false, ...over });
const line = (over: Partial<MarginLine> = {}): MarginLine => ({ lineType: "STOCK", quantity: 1, unitPrice: 100, unitCost: 60, vatRate: 15, discountPercent: 0, ...over });

test("only real stock moves", () => {
    assert.equal(movesStock(product()), true);
    assert.equal(movesStock(product({ type: "TYRE" })), true);
    assert.equal(movesStock(product({ type: "LABOUR" })), false);
    assert.equal(movesStock(product({ type: "SUBLET" })), false);
    assert.equal(movesStock(product({ isService: true })), false);
    assert.equal(movesStock(product({ dontUpdateQty: true })), false, "the workshop asked us not to count this one");
    assert.equal(movesStock(null), false, "a free-text line has no product");
});

test("sales and credits post stock; quotes and job cards do not", () => {
    assert.equal(postsStock("INVOICE"), true);
    assert.equal(postsStock("CASH_SALE"), true);
    assert.equal(postsStock("CREDIT"), true, "a credit note carries negative quantities, which put stock back");
    assert.equal(postsStock("QUOTE"), false);
    assert.equal(postsStock("JOB_CARD"), false);
    assert.equal(postsStock("BOOKING"), false);
});

test("a credit note's negative quantities read as money coming back off the books", () => {
    const creditLine = line({ quantity: -1 });
    assert.deepEqual(marginOf([creditLine], false), { sales: -100, cost: -60, profit: -40, percent: 40 });
    assert.deepEqual(marginOf([line(), creditLine], false), { sales: 0, cost: 0, profit: 0, percent: null }, "a sale and its credit cancel out");
});

test("margin is worked out excluding tax, whichever way prices are quoted", () => {
    assert.deepEqual(marginOf([line()], false), { sales: 100, cost: 60, profit: 40, percent: 40 });
    // The same sale quoted tax-inclusive: 100 incl. VAT is 86.96 of sales.
    const inclusive = marginOf([line()], true);
    assert.deepEqual(inclusive, { sales: 86.96, cost: 60, profit: 26.96, percent: 31 });
});

test("quantity and discount both bite", () => {
    assert.deepEqual(marginOf([line({ quantity: 4 })], false), { sales: 400, cost: 240, profit: 160, percent: 40 });
    assert.deepEqual(marginOf([line({ discountPercent: 25 })], false), { sales: 75, cost: 60, profit: 15, percent: 20 });
    assert.deepEqual(marginOf([line({ discountPercent: 50 })], false), { sales: 50, cost: 60, profit: -10, percent: -20 }, "selling under cost shows as a loss");
});

test("a nil sale has no margin rather than a zero one", () => {
    assert.equal(marginOf([], false).percent, null);
    assert.equal(marginOf([line({ unitPrice: 0, unitCost: 0 })], false).percent, null);
});

test("labour and parts are reported apart", () => {
    const split = marginByLineType([line(), line({ lineType: "LABOUR", unitPrice: 500, unitCost: 0 })], false);
    assert.deepEqual(split.find((s) => s.lineType === "LABOUR")!.margin, { sales: 500, cost: 0, profit: 500, percent: 100 });
    assert.deepEqual(split.find((s) => s.lineType === "STOCK")!.margin.profit, 40);
});

test("parts sold at no cost are counted, because that is a mistake not a margin", () => {
    assert.equal(missingCost([line({ unitCost: 0 }), line(), line({ lineType: "LABOUR", unitCost: 0 })]), 1);
});
