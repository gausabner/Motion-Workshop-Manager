import { test } from "node:test";
import assert from "node:assert/strict";
import { customerSchema } from "./schema";
import { fullName, greetingName } from "../format";

const issues = (input: Record<string, unknown>) => {
    const parsed = customerSchema.safeParse(input);
    return parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
};

test("a person needs a first and a last name", () => {
    assert.deepEqual(issues({ lastName: "Iipumbu" }), { firstName: "Enter a first name." });
    assert.deepEqual(issues({ firstName: "Ndapewa" }), { lastName: "Enter a last name." });
    assert.deepEqual(issues({ firstName: "Ndapewa", lastName: "Iipumbu" }), {});
});

test("a business or fleet account has one name, kept whole in lastName, and no first name", () => {
    assert.deepEqual(issues({ isBusiness: true }), { lastName: "Enter the business or department name." });
    const parsed = customerSchema.parse({ isBusiness: true, firstName: "left over", lastName: "Water and sanitation" });
    assert.equal(parsed.firstName, "");
    assert.equal(parsed.lastName, "Water and sanitation");
    assert.equal(fullName(parsed), "Water and sanitation");
});

test("a message greets a person by first name and a business by its name, never with a blank", () => {
    assert.equal(greetingName({ firstName: "Ndapewa", lastName: "Iipumbu" }), "Ndapewa");
    assert.equal(greetingName({ firstName: "", lastName: "Water and sanitation" }), "Water and sanitation");
    assert.equal(greetingName({ firstName: "  ", lastName: null }), "");
});
