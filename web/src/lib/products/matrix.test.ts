import { test } from "node:test";
import assert from "node:assert/strict";
import { bandFor, marginPercent, matrixWarnings, priceFrom, roundPrice, STARTER_BANDS, type Matrix } from "./matrix";

const matrix = (over: Partial<Matrix> = {}): Matrix => ({ basis: "MARKUP", rounding: "NONE", bands: STARTER_BANDS, ...over });

test("a cost lands in the band that contains it, edges included", () => {
    assert.equal(bandFor(10, STARTER_BANDS)!.percent, 100);
    assert.equal(bandFor(50, STARTER_BANDS)!.percent, 100, "the top of a band belongs to it");
    assert.equal(bandFor(50.01, STARTER_BANDS)!.percent, 75);
    assert.equal(bandFor(5000, STARTER_BANDS)!.percent, 35, "an open-ended band catches everything above");
});

test("markup adds to the cost; margin comes out of the price", () => {
    assert.equal(priceFrom(100, matrix({ bands: [{ costFrom: 0, costTo: null, percent: 50 }] })), 150);
    assert.equal(priceFrom(100, matrix({ basis: "MARGIN", bands: [{ costFrom: 0, costTo: null, percent: 50 }] })), 200, "a 50% margin doubles the cost");
    assert.equal(marginPercent(100, 200), 50);
    assert.equal(marginPercent(100, 150), 33.33);
});

test("the starter bands charge more on the cheap things", () => {
    assert.equal(priceFrom(20, matrix()), 40);
    assert.equal(priceFrom(100, matrix()), 175);
    assert.equal(priceFrom(500, matrix()), 775);
    assert.equal(priceFrom(2000, matrix()), 2700);
});

test("rounding always goes up, because rounding down gives margin away", () => {
    assert.equal(roundPrice(174.2, "NONE"), 174.2);
    assert.equal(roundPrice(174.2, "WHOLE"), 175);
    assert.equal(roundPrice(174.2, "NEAREST_5"), 175);
    assert.equal(roundPrice(176, "NEAREST_10"), 180);
    assert.equal(roundPrice(174.2, "ENDS_99"), 174.99);
    assert.equal(roundPrice(0, "WHOLE"), 0);
});

test("a matrix that cannot price something leaves the price alone", () => {
    assert.equal(priceFrom(0, matrix()), null, "nothing to mark up");
    assert.equal(priceFrom(-5, matrix()), null);
    assert.equal(priceFrom(100, matrix({ bands: [{ costFrom: 200, costTo: null, percent: 50 }] })), null, "no band covers it");
    assert.equal(priceFrom(100, matrix({ basis: "MARGIN", bands: [{ costFrom: 0, costTo: null, percent: 100 }] })), null, "a 100% margin has no price");
    assert.equal(priceFrom(100, matrix({ bands: [{ costFrom: 0, costTo: null, percent: -10 }] })), null);
});

test("gaps, overlaps and a band that is not last are pointed out", () => {
    assert.deepEqual(matrixWarnings(STARTER_BANDS), []);
    assert.match(matrixWarnings([])[0], /no bands/);
    assert.match(matrixWarnings([{ costFrom: 0, costTo: 50, percent: 100 }, { costFrom: 80, costTo: null, percent: 50 }])[0], /between 50.00 and 80.00 fall in no band/);
    assert.match(matrixWarnings([{ costFrom: 0, costTo: 100, percent: 100 }, { costFrom: 50, costTo: null, percent: 50 }])[0], /overlap/);
    assert.match(matrixWarnings([{ costFrom: 0, costTo: null, percent: 100 }, { costFrom: 50, costTo: null, percent: 50 }])[0], /not the last one/);
    assert.match(matrixWarnings([{ costFrom: 0, costTo: 100, percent: 100 }])[0], /Nothing is priced above 100.00/);
    assert.match(matrixWarnings([{ costFrom: 10, costTo: null, percent: 100 }])[0], /Nothing is priced below 10.00/);
});

test("a later band wins where two overlap, so a correction added on the end takes effect", () => {
    const bands = [{ costFrom: 0, costTo: 100, percent: 100 }, { costFrom: 50, costTo: 100, percent: 40 }];
    assert.equal(bandFor(60, bands)!.percent, 40);
    assert.equal(bandFor(20, bands)!.percent, 100);
});
