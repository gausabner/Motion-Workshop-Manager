import { test } from "node:test";
import assert from "node:assert/strict";
import { bundleCost, bundlePrice, bundleWarnings, expandBundle, groupBundles, type BundleSpec } from "./bundles";
import { marginOf } from "@/lib/stock/rules";

const service = (over: Partial<BundleSpec> = {}): BundleSpec => ({
    productId: "svc", description: "Minor service", lineType: "LABOUR", pricing: "FIXED", price: 950, vatRate: 15,
    components: [
        { productId: "oil", description: "Engine oil 5 L", lineType: "STOCK", quantity: 1, unitPrice: 685, unitCost: 468, vatRate: 15 },
        { productId: "filter", description: "Oil filter", lineType: "STOCK", quantity: 1, unitPrice: 185, unitCost: 112, vatRate: 15 },
        { productId: "lab", description: "Labour, 1 hour", lineType: "LABOUR", quantity: 1, unitPrice: 650, unitCost: 0, vatRate: 15 },
    ],
    ...over,
});

test("a fixed-price bundle charges once: the price on the parent, the cost on the components", () => {
    const lines = expandBundle(service(), 1, "g1");
    assert.equal(lines.length, 4);
    const [parent, ...components] = lines;
    assert.deepEqual([parent.unitPrice, parent.unitCost], [950, 0]);
    assert.deepEqual(components.map((c) => c.unitPrice), [0, 0, 0], "components must not charge again");
    assert.deepEqual(components.map((c) => c.unitCost), [468, 112, 0]);
    // Sold at 950 having cost 580.
    const margin = marginOf(lines.map((l) => ({ lineType: l.lineType, quantity: l.quantity, unitPrice: l.unitPrice, unitCost: l.unitCost, vatRate: l.vatRate, discountPercent: 0 })), false);
    assert.deepEqual([margin.sales, margin.cost, margin.profit], [950, 580, 370]);
});

test("a summed bundle prices its components, and the parent is only a heading", () => {
    const lines = expandBundle(service({ pricing: "SUM" }), 1, "g1");
    const [parent, ...components] = lines;
    assert.deepEqual([parent.unitPrice, parent.unitCost], [0, 0]);
    assert.deepEqual(components.map((c) => c.unitPrice), [685, 185, 650]);
    const margin = marginOf(lines.map((l) => ({ lineType: l.lineType, quantity: l.quantity, unitPrice: l.unitPrice, unitCost: l.unitCost, vatRate: l.vatRate, discountPercent: 0 })), false);
    assert.deepEqual([margin.sales, margin.cost, margin.profit], [1520, 580, 940]);
});

test("two of a bundle means twice each component", () => {
    const lines = expandBundle(service(), 2, "g1");
    assert.equal(lines[0].quantity, 2);
    assert.deepEqual(lines.slice(1).map((c) => c.quantity), [2, 2, 2]);
    const margin = marginOf(lines.map((l) => ({ lineType: l.lineType, quantity: l.quantity, unitPrice: l.unitPrice, unitCost: l.unitCost, vatRate: l.vatRate, discountPercent: 0 })), false);
    assert.deepEqual([margin.sales, margin.cost], [1900, 1160]);
});

test("a component with a fractional quantity survives the multiplication", () => {
    const half = service({ components: [{ productId: "oil", description: "Oil", lineType: "STOCK", quantity: 4.5, unitPrice: 100, unitCost: 60, vatRate: 15 }] });
    assert.equal(expandBundle(half, 3, "g")[1].quantity, 13.5);
});

test("what a bundle is worth, both ways round", () => {
    assert.equal(bundlePrice(service()), 950);
    assert.equal(bundlePrice(service({ pricing: "SUM" })), 1520);
    assert.equal(bundleCost(service()), 580);
});

test("a bundle that would lose money, or charge nothing, says so", () => {
    assert.deepEqual(bundleWarnings(service()), []);
    assert.match(bundleWarnings(service({ price: 0 }))[0], /no price on it/);
    assert.match(bundleWarnings(service({ price: 400 }))[0], /cost 580.00, which is more than the 400.00/);
    assert.match(bundleWarnings(service({ components: [] }))[0], /nothing in it/);
});

test("expanded lines group back into the bundle they came from", () => {
    const lines = [...expandBundle(service(), 1, "g1"), { bundleGroup: null, bundleRole: null }, ...expandBundle(service(), 1, "g2")];
    const groups = groupBundles(lines as { bundleGroup?: string | null; bundleRole?: string | null }[]);
    assert.deepEqual([...groups.keys()], ["g1", "g2"]);
    assert.equal(groups.get("g1")!.components.length, 3);
    assert.ok(groups.get("g1")!.parent);
});
