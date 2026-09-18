import { test } from "node:test";
import assert from "node:assert/strict";
import { normalisePlate, parseVehicleDescription, plateDigits, vehicleDecision } from "./matching";

test("a plate is the same plate however it is typed", () => {
    assert.equal(normalisePlate("N 12345 W"), "N12345W");
    assert.equal(normalisePlate("n-12345-w"), "N12345W");
    assert.equal(plateDigits("N 12345 W"), "12345");
    assert.equal(plateDigits("CA 123-456"), "123");
});

test("a free-text vehicle becomes a make, a model and a year", () => {
    assert.deepEqual(parseVehicleDescription("Toyota Hilux 2016"), { make: "Toyota", model: "Hilux", year: 2016 });
    assert.deepEqual(parseVehicleDescription("2019 vw polo vivo"), { make: "VW", model: "Polo Vivo", year: 2019 });
    assert.deepEqual(parseVehicleDescription("Ford"), { make: "Ford", model: "Unknown", year: null });
    assert.deepEqual(parseVehicleDescription(""), { make: "Unknown", model: "Unknown", year: null });
    // Not a year: an engine size or a trim number.
    assert.deepEqual(parseVehicleDescription("BMW 3200 Coupe", 2026), { make: "BMW", model: "3200 Coupe", year: null });
});

test("a car on someone else's account is flagged, never moved", () => {
    assert.equal(vehicleDecision(null, "c1"), "create");
    assert.equal(vehicleDecision({ id: "v", plate: "N 1 W", customerId: null }, "c1"), "adopt");
    assert.equal(vehicleDecision({ id: "v", plate: "N 1 W", customerId: "c1" }, "c1"), "attach");
    assert.equal(vehicleDecision({ id: "v", plate: "N 1 W", customerId: "c2" }, "c1"), "conflict");
});
