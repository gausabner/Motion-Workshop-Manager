import { test } from "node:test";
import assert from "node:assert/strict";
import { setupProgress, setupSteps, type SetupFacts } from "./checklist";

const fresh: SetupFacts = {
    hasAddress: false, hasContact: true, taxReviewed: false, hasVatNumber: false, hasLogo: false,
    hasBankDetails: false, hoursSet: false, mechanics: 0, customers: 0, jobs: 0, onlineBooking: false,
};

test("a new workshop has none of the required steps done", () => {
    const p = setupProgress(setupSteps(fresh, "/w"));
    assert.deepEqual(p, { done: 0, total: 7, complete: false });
});

test("optional steps never hold a workshop back", () => {
    const ready = { ...fresh, hasAddress: true, taxReviewed: true, hasBankDetails: true, hoursSet: true, mechanics: 1, customers: 3, jobs: 1 };
    assert.equal(setupProgress(setupSteps(ready, "/w")).complete, true);
});

test("a VAT number counts as having checked tax", () => {
    const steps = setupSteps({ ...fresh, hasVatNumber: true }, "/w");
    assert.equal(steps.find((s) => s.key === "tax")!.done, true);
});

test("every step links inside the workshop", () => {
    for (const s of setupSteps(fresh, "/tiptop")) assert.ok(s.href.startsWith("/tiptop/dashboard/"), s.key);
});
