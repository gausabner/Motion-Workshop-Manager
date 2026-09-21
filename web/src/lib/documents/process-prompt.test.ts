import { test } from "node:test";
import assert from "node:assert/strict";
import { promptErrors, promptFor, suggestNextService } from "./process-prompt";

test("only the documents that mean the car came in ask about it", () => {
    assert.equal(promptFor("INVOICE", true), "service");
    assert.equal(promptFor("CASH_SALE", true), "service");
    assert.equal(promptFor("JOB_CARD", true), "arrival");
    assert.equal(promptFor("QUOTE", true), "none");
    assert.equal(promptFor("CREDIT", true), "none");
    assert.equal(promptFor("INVOICE", false), "none");
});

const invoice = { kind: "service" as const, lastOdometer: 88_400, postDate: "2026-09-18" };
const blank = { odometer: null, nextServiceKm: null, nextServiceDate: null, licenceExpiry: null, roadworthyExpiry: null, odometerCorrected: false };

test("an invoice needs today's reading, and the next service has to be ahead of it", () => {
    assert.match(promptErrors(blank, invoice).odometer, /next service is worked out from/);
    assert.deepEqual(promptErrors({ ...blank, odometer: 91_250, nextServiceKm: 101_000, nextServiceDate: "2027-09-18" }, invoice), {});
    assert.match(promptErrors({ ...blank, odometer: 91_250, nextServiceKm: 90_000 }, invoice).nextServiceKm, /further on/);
    assert.match(promptErrors({ ...blank, odometer: 91_250, nextServiceDate: "2026-09-01" }, invoice).nextServiceDate, /after today/);
});

test("a reading lower than the last is refused unless someone says why", () => {
    assert.match(promptErrors({ ...blank, odometer: 12_000 }, invoice).odometer, /Lower than the last reading of 88,400/);
    assert.deepEqual(promptErrors({ ...blank, odometer: 12_000, odometerCorrected: true }, invoice), {});
    assert.match(promptErrors({ ...blank, odometer: -5 }, invoice).odometer, /not a reading/);
});

test("a job card's arrival reading is optional, and a quote asks nothing", () => {
    assert.deepEqual(promptErrors(blank, { ...invoice, kind: "arrival" }), {});
    assert.deepEqual(promptErrors({ ...blank, odometer: 5 }, { ...invoice, kind: "none" }), {});
});

test("the suggested next service is the usual interval on, rounded, and never an impossible date", () => {
    assert.deepEqual(suggestNextService(91_250, "2026-09-18"), { nextServiceKm: 101_000, nextServiceDate: "2027-09-18" });
    assert.equal(suggestNextService(null, "2026-01-31", { km: 10_000, months: 1 }).nextServiceDate, "2026-02-28");
    assert.equal(suggestNextService(null, "2026-09-18").nextServiceKm, null);
});
