import { test } from "node:test";
import assert from "node:assert/strict";
import { asPlanId, blockedModels, featuresOf, includes } from "@/lib/plans/features";
import { PLANS } from "@/lib/pricing/plans";

test("each plan includes everything below it, and nothing above it", () => {
    assert.deepEqual(featuresOf("workshop"), []);
    assert.ok(includes("full", "stock") && includes("full", "inspections") && includes("full", "ownerReports"));
    assert.ok(!includes("full", "api") && !includes("full", "handoff") && !includes("full", "auditPack"));
    assert.ok(includes("council", "api") && includes("council", "stock"));
});

test("a workshop with no plan keeps everything until its billing is set up", () => {
    assert.equal(featuresOf(null).length, featuresOf("council").length);
});

test("plan ids are the pricing page's, and anything else is not guessed at", () => {
    for (const plan of PLANS) assert.equal(asPlanId(plan.id), plan.id);
    assert.equal(asPlanId("enterprise"), null);
    assert.equal(asPlanId(null), null);
});

test("the database refuses only feature-owned tables, and never the ones everyday work writes", () => {
    const base = blockedModels("workshop");
    assert.equal(base.get("PurchaseOrder"), "purchasing");
    assert.equal(base.get("Inspection"), "inspections");
    assert.equal(base.get("ApiKey"), "api");
    // Posted when an invoice is processed, or unlinked when a document is deleted.
    for (const everyday of ["Document", "DocumentLine", "Product", "StockMovement", "SerialUnit", "Reminder", "Payment", "Customer"]) {
        assert.equal(base.has(everyday), false, `${everyday} must never be refused`);
    }
    assert.equal(blockedModels("full").has("PurchaseOrder"), false);
    assert.equal(blockedModels("full").get("ApiKey"), "api");
    assert.equal(blockedModels(null).size, 0);
});
