import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldsUsed, MERGE_FIELDS, renderTemplate, unknownFields } from "./merge";

test("fields are substituted, whatever the spacing or case", () => {
    assert.equal(
        renderTemplate("Hi {{customer_first_name}}, your {{ VEHICLE }} ({{plate}}) is ready.", {
            customer_first_name: "Courtney",
            vehicle: "2021 Toyota Hilux",
            plate: "N 4821 W",
        }),
        "Hi Courtney, your 2021 Toyota Hilux (N 4821 W) is ready.",
    );
});

test("numbers are allowed through as themselves", () => {
    assert.equal(renderTemplate("Total N$ {{total}}.", { total: 1820 }), "Total N$ 1820.");
});

test("a line whose fields all came back empty is dropped whole", () => {
    // The seeded "Next service" note, used on a job that has no service interval.
    assert.equal(renderTemplate("Next service due at {{next_service_km}} km or {{next_service_date}}, whichever comes first.", {}), "");
    assert.equal(renderTemplate("Queries: {{workshop_phone}}.", {}), "");
    assert.equal(renderTemplate("Thank you.\nQueries: {{workshop_phone}}.", {}), "Thank you.");
});

test("a line that still has something to say keeps it, minus the empty brackets", () => {
    assert.equal(
        renderTemplate("Hi {{customer_first_name}}, your {{vehicle}} ({{plate}}) is ready.", { customer_first_name: "Courtney", vehicle: "2021 Toyota Hilux" }),
        "Hi Courtney, your 2021 Toyota Hilux is ready.",
    );
});

test("a line with no fields at all is never dropped", () => {
    assert.equal(renderTemplate("Vehicle left at owner's risk.", {}), "Vehicle left at owner's risk.");
});

test("blank lines left by empty fields collapse instead of stacking", () => {
    assert.equal(renderTemplate("One\n\n{{bank_details}}\n\n\nTwo", {}), "One\n\nTwo");
});

test("an unknown field never shows the customer a raw token", () => {
    assert.equal(renderTemplate("Ref {{not_a_field}} here", {}), "");
    assert.equal(renderTemplate("Ref {{not_a_field}} for {{plate}}", { plate: "N 4821 W" }), "Ref for N 4821 W");
});

test("the fields a template uses can be listed, and the typos found", () => {
    const body = "Hi {{customer_first_name}}, {{vehicle}} at {{workshp_name}}";
    assert.deepEqual(fieldsUsed(body), ["customer_first_name", "vehicle", "workshp_name"]);
    assert.deepEqual(unknownFields(body), ["workshp_name"]);
});

test("every catalogued field has a unique key", () => {
    const keys = MERGE_FIELDS.map((f) => f.key);
    assert.equal(new Set(keys).size, keys.length);
});
