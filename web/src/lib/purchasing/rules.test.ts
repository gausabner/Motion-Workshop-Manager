import { test } from "node:test";
import assert from "node:assert/strict";
import { canEditOrder, costTotals, keepMarginPrice, orderStateAfterReceipt, outstanding, processInvoiceError, receiptState, unitCostExTax } from "./rules";

test("a supplier's document is totalled on its own tax basis", () => {
    const lines = [{ quantity: 4, unitCost: 100 }, { quantity: 1, unitCost: 50, taxExempt: true }];
    assert.deepEqual(costTotals(lines, { taxRate: 15, pricesIncludeTax: false }), { subtotal: 450, taxTotal: 60, total: 510 });
    // The same figures quoted tax-inclusive: 400 incl. is 347.83 of cost.
    assert.deepEqual(costTotals(lines, { taxRate: 15, pricesIncludeTax: true }), { subtotal: 397.83, taxTotal: 52.17, total: 450 });
});

test("freight is added before tax and taxed with the rest", () => {
    assert.deepEqual(costTotals([{ quantity: 1, unitCost: 100 }], { taxRate: 15, pricesIncludeTax: false, freight: 50 }), { subtotal: 150, taxTotal: 22.5, total: 172.5 });
});

test("outstanding never goes negative, however much arrives", () => {
    assert.equal(outstanding({ id: "a", quantity: 10, received: 4 }), 6);
    assert.equal(outstanding({ id: "a", quantity: 10, received: 10 }), 0);
    assert.equal(outstanding({ id: "a", quantity: 10, received: 12 }), 0);
});

test("an order reads as part received until every line is in", () => {
    assert.equal(receiptState([]), "none");
    assert.equal(receiptState([{ id: "a", quantity: 10, received: 0 }]), "none");
    assert.equal(receiptState([{ id: "a", quantity: 10, received: 4 }]), "part");
    assert.equal(receiptState([{ id: "a", quantity: 10, received: 4 }, { id: "b", quantity: 2, received: 2 }]), "part");
    assert.equal(receiptState([{ id: "a", quantity: 10, received: 10 }]), "full");
    assert.equal(receiptState([{ id: "a", quantity: 10, received: 11 }]), "over");
});

test("receipt moves the order on, and a cancelled order stays cancelled", () => {
    assert.equal(orderStateAfterReceipt("SUGGESTED", [{ id: "a", quantity: 5, received: 2 }]), "ORDERED");
    assert.equal(orderStateAfterReceipt("ORDERED", [{ id: "a", quantity: 5, received: 2 }]), "ORDERED");
    assert.equal(orderStateAfterReceipt("ORDERED", [{ id: "a", quantity: 5, received: 5 }]), "RECEIVED");
    assert.equal(orderStateAfterReceipt("ORDERED", [{ id: "a", quantity: 5, received: 6 }]), "RECEIVED");
    assert.equal(orderStateAfterReceipt("CANCELLED", [{ id: "a", quantity: 5, received: 5 }]), "CANCELLED");
});

test("an order stops being editable once goods arrive against it", () => {
    assert.equal(canEditOrder("SUGGESTED", false), true);
    assert.equal(canEditOrder("SUGGESTED", true), true, "a suggestion is a scratchpad");
    assert.equal(canEditOrder("ORDERED", false), true);
    assert.equal(canEditOrder("ORDERED", true), false);
    assert.equal(canEditOrder("RECEIVED", false), false);
    assert.equal(canEditOrder("CANCELLED", false), false);
});

test("a supplier invoice says what is missing before it will process", () => {
    assert.match(processInvoiceError("DRAFT", 0, "INV-77")!, /at least one line/);
    assert.match(processInvoiceError("DRAFT", 2, "  ")!, /supplier's invoice number/);
    assert.match(processInvoiceError("PROCESSED", 2, "INV-77")!, /Only a draft/);
    assert.equal(processInvoiceError("DRAFT", 2, "INV-77"), null);
});

test("what goes on the shelf is always the cost without tax", () => {
    assert.equal(unitCostExTax(115, 15, true), 100);
    assert.equal(unitCostExTax(100, 15, false), 100);
    assert.equal(unitCostExTax(100, 15, true, true), 100, "an exempt line has no tax in it to take out");
});

test("a new cost can keep the margin the product sells at", () => {
    assert.equal(keepMarginPrice(120, 100, 200), 240, "50% margin kept");
    assert.equal(keepMarginPrice(120, 100, 100), null, "no margin to keep");
    assert.equal(keepMarginPrice(120, 0, 200), null, "nothing to compare against");
});
