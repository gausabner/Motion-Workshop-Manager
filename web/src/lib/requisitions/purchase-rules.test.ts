import { test } from "node:test";
import assert from "node:assert/strict";
import { orderError, pricedFromQuote, shortfall, splitError } from "@/lib/requisitions/purchase-rules";

/** What stores cannot meet becomes a purchase, and the order is priced at what the chosen supplier quoted. */

test("stores splits off all of what it does not keep, and only what the shelf is short of on the rest", () => {
    const lines = [
        { id: "oil", quantity: 2, issued: 1, moved: 0, stocked: true, onHand: 5 },
        { id: "seal", quantity: 3, issued: 0, moved: 0, stocked: true, onHand: 1 },
        { id: "bearing", quantity: 2, issued: 0, moved: 0, stocked: false, onHand: null },
        { id: "done", quantity: 2, issued: 0, moved: 2, stocked: false, onHand: null },
        { id: "negative", quantity: 1, issued: 0, moved: 0, stocked: true, onHand: -3 },
    ];
    assert.deepEqual(shortfall(lines), [
        { lineId: "seal", quantity: 2 },
        { lineId: "bearing", quantity: 2 },
        { lineId: "negative", quantity: 1 },
    ]);
    assert.equal(splitError({ kind: "STORES", state: "APPROVED", short: 2 }), null);
    assert.match(splitError({ kind: "STORES", state: "AWAITING_HEAD", short: 2 }) ?? "", /has to be approved/);
    assert.match(splitError({ kind: "PURCHASE", state: "APPROVED", short: 2 }) ?? "", /Only a stores requisition/);
    assert.match(splitError({ kind: "STORES", state: "APPROVED", short: 0 }) ?? "", /nothing to buy/);
});

test("the order adds up to the quotation the approvers chose", () => {
    // Estimated at 3,000; quoted at 3,300: every line ten per cent up.
    assert.deepEqual(pricedFromQuote([{ quantity: 2, unitCost: 1280 }, { quantity: 1, unitCost: 440 }], 3300), [1408, 484]);
    const odd = pricedFromQuote([{ quantity: 3, unitCost: 100 }, { quantity: 1, unitCost: 50 }], 1000);
    assert.ok(Math.abs(3 * odd[0] + odd[1] - 1000) < 0.05, "to the cent, give or take rounding");
    assert.deepEqual(pricedFromQuote([{ quantity: 2, unitCost: 0 }, { quantity: 2, unitCost: 0 }], 1000), [250, 250], "no estimates: shared by quantity");
    assert.equal(orderError({ kind: "PURCHASE", state: "APPROVED", chosen: true, ordered: false }), null);
    assert.match(orderError({ kind: "PURCHASE", state: "APPROVED", chosen: true, ordered: true }) ?? "", /already been ordered/);
    assert.match(orderError({ kind: "PURCHASE", state: "AWAITING_HEAD", chosen: true, ordered: false }) ?? "", /approved before/);
    assert.match(orderError({ kind: "STORES", state: "APPROVED", chosen: false, ordered: false }) ?? "", /Only a purchase requisition/);
});
