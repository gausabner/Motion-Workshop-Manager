import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateLine, calculateTotals, amountDue, round2 } from "./totals";

const VAT = 15;

test("VAT-inclusive line backs the tax out of the price", () => {
    // A N$ 685.00 tin of oil at 15% inclusive: net 595.65, VAT 89.35.
    const t = calculateLine({ quantity: 1, unitPrice: 685, vatRate: VAT }, true);
    assert.equal(t.lineSubtotal, 595.65);
    assert.equal(t.vatAmount, 89.35);
    assert.equal(t.lineTotal, 685);
});

test("VAT-exclusive line adds the tax on top", () => {
    const t = calculateLine({ quantity: 2, unitPrice: 100, vatRate: VAT }, false);
    assert.equal(t.lineSubtotal, 200);
    assert.equal(t.vatAmount, 30);
    assert.equal(t.lineTotal, 230);
});

test("line discount reduces net, VAT and total together", () => {
    const t = calculateLine({ quantity: 1, unitPrice: 1000, vatRate: VAT, discountPercent: 10 }, false);
    assert.equal(t.lineSubtotal, 900);
    assert.equal(t.vatAmount, 135);
    assert.equal(t.lineTotal, 1035);
});

test("a zero-rated line carries no VAT", () => {
    const t = calculateLine({ quantity: 3, unitPrice: 50, vatRate: 0 }, true);
    assert.equal(t.lineSubtotal, 150);
    assert.equal(t.vatAmount, 0);
});

test("quantity and price default to zero rather than NaN", () => {
    const t = calculateLine({ quantity: Number("x"), unitPrice: Number(undefined), vatRate: VAT }, true);
    assert.equal(t.lineTotal, 0);
});

test("a minor service totals and carries cost through to profit", () => {
    // Labour 950 + oil 685 + filter 185, all VAT-inclusive; cost only on the parts.
    const totals = calculateTotals({
        pricesIncludeTax: true,
        lines: [
            { quantity: 1, unitPrice: 950, unitCost: 0, vatRate: VAT },
            { quantity: 1, unitPrice: 685, unitCost: 468, vatRate: VAT },
            { quantity: 1, unitPrice: 185, unitCost: 112, vatRate: VAT },
        ],
    });
    assert.equal(totals.total, 1820);
    assert.equal(totals.subtotal, 1582.61);
    assert.equal(totals.vatTotal, 237.39);
    assert.equal(round2(totals.subtotal + totals.vatTotal), totals.total);
    assert.equal(totals.totalCost, 580);
    assert.equal(totals.grossProfit, 1002.61);
});

test("header percent discount reduces VAT in proportion", () => {
    const totals = calculateTotals({
        pricesIncludeTax: false,
        discountPercent: 10,
        lines: [{ quantity: 1, unitPrice: 1000, vatRate: VAT }],
    });
    assert.equal(totals.grossSubtotal, 1000);
    assert.equal(totals.discountApplied, 100);
    assert.equal(totals.subtotal, 900);
    assert.equal(totals.vatTotal, 135);
    assert.equal(totals.total, 1035);
});

test("header amount discount cannot exceed the subtotal", () => {
    const totals = calculateTotals({
        pricesIncludeTax: false,
        discountAmount: 5000,
        lines: [{ quantity: 1, unitPrice: 400, vatRate: VAT }],
    });
    assert.equal(totals.discountApplied, 400);
    assert.equal(totals.subtotal, 0);
    assert.equal(totals.vatTotal, 0);
    assert.equal(totals.total, 0);
});

test("a percent discount wins when an amount is also present", () => {
    const totals = calculateTotals({
        pricesIncludeTax: false,
        discountPercent: 50,
        discountAmount: 10,
        lines: [{ quantity: 1, unitPrice: 200, vatRate: VAT }],
    });
    assert.equal(totals.discountApplied, 100);
});

test("freight is added after the discount and taxed at its own rate", () => {
    const totals = calculateTotals({
        pricesIncludeTax: false,
        freight: 150,
        freightVatRate: VAT,
        lines: [{ quantity: 1, unitPrice: 1000, vatRate: VAT }],
    });
    assert.equal(totals.subtotal, 1150);
    assert.equal(totals.vatTotal, 172.5);
    assert.equal(totals.total, 1322.5);
});

test("an empty document totals to zero without dividing by zero", () => {
    const totals = calculateTotals({ pricesIncludeTax: true, lines: [], discountPercent: 10 });
    assert.equal(totals.total, 0);
    assert.equal(totals.grossMarginPercent, 0);
});

test("selling below cost reports a negative profit", () => {
    const totals = calculateTotals({
        pricesIncludeTax: false,
        lines: [{ quantity: 1, unitPrice: 100, unitCost: 250, vatRate: VAT }],
    });
    assert.equal(totals.grossProfit, -150);
});

test("amount due never goes negative on an overpayment", () => {
    assert.equal(amountDue(1000, 250), 750);
    assert.equal(amountDue(1000, 1200), 0);
});

test("round2 does not lose the half cent to float error", () => {
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(2.675), 2.68);
});

test("a credit note's outstanding is negative until it is applied", () => {
    assert.equal(amountDue(-890, 0), -890);
    assert.equal(amountDue(-890, -400), -490);
    assert.equal(amountDue(-890, -890), 0);
    // Over-applying a credit reads as settled, never as money owed.
    assert.equal(amountDue(-890, -1000), 0);
});
