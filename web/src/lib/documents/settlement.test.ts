import { test } from "node:test";
import assert from "node:assert/strict";
import { clampAllocation, paymentPostingError, stateAfterAllocation, stateOnProcess, unallocatedAmount } from "./settlement";

test("a normal invoice is PROCESSED when posted", () => {
    assert.equal(stateOnProcess("INVOICE", 2518.5), "PROCESSED");
});

test("a zero-value invoice closes on process instead of sitting in Unpaid", () => {
    assert.equal(stateOnProcess("INVOICE", 0), "CLOSED");
    assert.equal(stateOnProcess("CASH_SALE", 0.004), "CLOSED");
});

test("a zero-value job card or quote is still just PROCESSED", () => {
    assert.equal(stateOnProcess("JOB_CARD", 0), "PROCESSED");
    assert.equal(stateOnProcess("QUOTE", 0), "PROCESSED");
});

test("the benchmark sequence: part payment stays PROCESSED, settlement closes", () => {
    // Observed live: 2518.50 invoice, paid 1500.00 then 1018.50.
    assert.equal(stateAfterAllocation("PROCESSED", "INVOICE", 2518.5, 1500), "PROCESSED");
    assert.equal(stateAfterAllocation("PROCESSED", "INVOICE", 2518.5, 2518.5), "CLOSED");
});

test("float drift at the cent does not keep an invoice open", () => {
    assert.equal(stateAfterAllocation("PROCESSED", "INVOICE", 0.3, 0.1 + 0.2), "CLOSED");
});

test("an overpayment still closes the invoice", () => {
    assert.equal(stateAfterAllocation("PROCESSED", "INVOICE", 100, 150), "CLOSED");
});

test("voiding a payment re-opens a closed invoice", () => {
    assert.equal(stateAfterAllocation("CLOSED", "INVOICE", 2518.5, 1500), "PROCESSED");
});

test("drafts, voids and job cards never move on allocation", () => {
    assert.equal(stateAfterAllocation("DRAFT", "INVOICE", 100, 100), "DRAFT");
    assert.equal(stateAfterAllocation("VOID", "INVOICE", 100, 100), "VOID");
    assert.equal(stateAfterAllocation("PROCESSED", "JOB_CARD", 100, 100), "PROCESSED");
});

test("a credit note with a negative total settles on its absolute value", () => {
    assert.equal(stateAfterAllocation("PROCESSED", "CREDIT", -890, -400), "PROCESSED");
    assert.equal(stateAfterAllocation("PROCESSED", "CREDIT", -890, -890), "CLOSED");
});

test("unapplied credit is what was tendered but not allocated", () => {
    assert.equal(unallocatedAmount([1000, 500], [1200]), 300);
    assert.equal(unallocatedAmount([1500], [1500]), 0);
    assert.equal(unallocatedAmount([500], []), 500);
});

test("a split tender across cash, card and EFT can settle one invoice", () => {
    assert.equal(paymentPostingError([200, 800, 1518.5], [2518.5]), null);
});

test("a payment taken on account with no allocation can post", () => {
    assert.equal(paymentPostingError([500], []), null);
});

test("a payment cannot allocate more than was tendered", () => {
    assert.match(paymentPostingError([1000], [1200]) ?? "", /more than the 1000\.00 tendered/);
});

test("a payment with nothing tendered cannot post", () => {
    assert.match(paymentPostingError([], []) ?? "", /at least one tender/);
    assert.match(paymentPostingError([0], []) ?? "", /at least one tender/);
});

test("negative tenders are rejected — money cannot come in backwards", () => {
    assert.match(paymentPostingError([100, -20], []) ?? "", /cannot be negative/);
});

test("a credit note applied to an invoice posts with nothing tendered", () => {
    // +300 onto the invoice, −300 off the credit note: no money changes hands.
    assert.equal(paymentPostingError([], [300, -300]), null);
});

test("a credit that more than covers the invoice cannot be posted as a receipt", () => {
    assert.match(paymentPostingError([], [300, -500]) ?? "", /refund, not a receipt/);
});

test("a refund is the same rule mirrored: cash out against a credit note", () => {
    assert.equal(paymentPostingError([-620], [-620], "REFUND"), null);
    // Paying out unapplied credit needs no document at all.
    assert.equal(paymentPostingError([-500], [], "REFUND"), null);
});

test("a refund cannot draw down more credit than it pays out", () => {
    assert.match(paymentPostingError([-620], [-700], "REFUND") ?? "", /more than the 620\.00 being paid out/);
});

test("a refund cannot be pointed at an invoice, nor pay money in", () => {
    assert.match(paymentPostingError([-620], [300], "REFUND") ?? "", /Take a receipt instead/);
    assert.match(paymentPostingError([620], [], "REFUND") ?? "", /cannot be positive/);
    assert.match(paymentPostingError([], [], "REFUND") ?? "", /what is being paid out/);
});

test("money out reads as the opposite of money left over", () => {
    assert.equal(unallocatedAmount([-500], []), -500);
    assert.equal(unallocatedAmount([-620], [-620]), 0);
});

test("an allocation is trimmed to what the document can take", () => {
    assert.equal(clampAllocation(400, 600), 400);
    assert.equal(clampAllocation(400, 250), 250);
    assert.equal(clampAllocation(400, -100), 0);
    assert.equal(clampAllocation(0, 100), 0);
});

test("a credit note only absorbs negative allocations, down to its own outstanding", () => {
    assert.equal(clampAllocation(-890, -1000), -890);
    assert.equal(clampAllocation(-890, -400), -400);
    assert.equal(clampAllocation(-890, 400), 0);
});
