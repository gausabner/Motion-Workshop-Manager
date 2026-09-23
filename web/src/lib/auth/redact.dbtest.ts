import { test } from "node:test";
import assert from "node:assert/strict";
import type { Membership } from "@prisma/client";
import { redactContact, redactContactAll } from "@/lib/auth/redact";
import { ALL_GROUPS, can } from "@/lib/auth/permissions";

/**
 * A mechanic on the workshop floor could read every customer's address and
 * telephone number. That is unremarkable among six people who know each other
 * and unacceptable to a municipality, and it is the first thing a security
 * review looks for.
 */

const customer = {
    id: "c1",
    firstName: "Gugulethu",
    lastName: "Mokwena",
    mobile: "+264 81 900 0829",
    phone: "+264 61 605 9542",
    email: "g.mokwena@example.invalid",
    streetAddress1: "12 Sam Nujoma Drive",
    streetCity: "Windhoek",
};
const as = (group: string, extras: string[] = []) =>
    ({ group, extraPermissions: extras }) as unknown as Membership;

test("a mechanic is given the name and nothing to reach them by", () => {
    const seen = redactContact(customer, as("MECHANIC"));
    assert.equal(seen.firstName, "Gugulethu", "the name must survive — a job card with no customer is unusable");
    assert.equal(seen.lastName, "Mokwena");
    for (const field of ["mobile", "phone", "email", "streetAddress1", "streetCity"] as const) {
        assert.equal(seen[field], null, `${field} reached a role that may not see it`);
    }
});

test("the counter still sees everything it needs", () => {
    const seen = redactContact(customer, as("SERVICE_ADVISOR"));
    assert.equal(seen.mobile, customer.mobile);
    assert.equal(seen.email, customer.email);
});

test("a grant restores contact without changing the role", () => {
    // How a workshop widens one person rather than promoting them.
    const seen = redactContact(customer, as("MECHANIC", ["customers:view_contact"]));
    assert.equal(seen.mobile, customer.mobile);
});

test("the whole list is covered, not only the first row", () => {
    const rows = redactContactAll([customer, { ...customer, id: "c2" }], as("READ_ONLY"));
    assert.deepEqual(rows.map((r) => r.mobile), [null, null]);
});

test("nobody who may edit a customer is denied their details", () => {
    // The dangerous pair: blanked fields in an editable form are a way to
    // erase a telephone number by pressing Save.
    const bad = ALL_GROUPS.filter(
        (g) => can({ group: g }, "customers:write") && !can({ group: g }, "customers:view_contact"),
    );
    assert.deepEqual(bad, [], `${bad.join(", ")} can edit customers but not see their details`);
});
