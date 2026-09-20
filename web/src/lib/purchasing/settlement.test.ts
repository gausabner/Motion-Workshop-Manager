import { test } from "node:test";
import assert from "node:assert/strict";
import { clampSupplierAllocation, spreadOldestFirst, stateAfterSupplierAllocation, supplierOutstanding, supplierPaymentError } from "./settlement";

test("what is owed is the total less what has been applied", () => {
    assert.equal(supplierOutstanding(1150, 0), 1150);
    assert.equal(supplierOutstanding(1150, 400), 750);
    assert.equal(supplierOutstanding(1150, 1150), 0);
});

test("an invoice closes when it is settled and re-opens when a payment is reversed", () => {
    assert.equal(stateAfterSupplierAllocation("PROCESSED", 1150, 1150), "CLOSED");
    assert.equal(stateAfterSupplierAllocation("PROCESSED", 1150, 400), "PROCESSED");
    assert.equal(stateAfterSupplierAllocation("CLOSED", 1150, 0), "PROCESSED", "reversing a payment re-opens it");
    assert.equal(stateAfterSupplierAllocation("VOID", 1150, 0), "VOID", "a voided invoice stays voided");
    assert.equal(stateAfterSupplierAllocation("DRAFT", 1150, 0), "DRAFT");
});

test("nothing is applied beyond what an invoice has left", () => {
    assert.equal(clampSupplierAllocation(750, 1000), 750);
    assert.equal(clampSupplierAllocation(750, 200), 200);
    assert.equal(clampSupplierAllocation(0, 200), 0);
    assert.equal(clampSupplierAllocation(750, -50), 0);
});

test("a payment must match what it is applied to, exactly", () => {
    assert.match(supplierPaymentError(0, [100])!, /what is being paid/);
    assert.match(supplierPaymentError(500, [])!, /at least one invoice/);
    assert.match(supplierPaymentError(500, [0])!, /at least one invoice/);
    assert.match(supplierPaymentError(500, [300, 400])!, /more than the 500.00 being paid/);
    assert.match(supplierPaymentError(500, [300])!, /200.00 of this payment is not against any invoice/);
    assert.match(supplierPaymentError(500, [600, -100])!, /cannot be negative/);
    assert.equal(supplierPaymentError(500, [300, 200]), null);
});

test("a lump sum goes against the oldest invoices first, and stops when it runs out", () => {
    const invoices = [{ id: "a", outstanding: 300 }, { id: "b", outstanding: 500 }, { id: "c", outstanding: 200 }];
    assert.deepEqual([...spreadOldestFirst(1000, invoices)], [["a", 300], ["b", 500], ["c", 200]]);
    assert.deepEqual([...spreadOldestFirst(650, invoices)], [["a", 300], ["b", 350]], "the last one takes the remainder");
    assert.deepEqual([...spreadOldestFirst(0, invoices)], []);
    assert.deepEqual([...spreadOldestFirst(5000, invoices)], [["a", 300], ["b", 500], ["c", 200]], "never more than is owed");
});
