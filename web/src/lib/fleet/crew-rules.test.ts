import { test } from "node:test";
import assert from "node:assert/strict";
import { assignError, hasStaff, isStaffRole, leadOf, mayAssign } from "@/lib/fleet/crew-rules";

const person = { membershipId: "m1", designations: [], foremanOf: ["heavy"] };

test("staff belong to workshops and bays, as mechanics, artisans or interns", () => {
    assert.deepEqual(["RECEPTION", "CHECK_BAY", "WORKSHOP", "BAY"].map((k) => hasStaff(k as never)), [false, false, true, true]);
    assert.deepEqual(["MECHANIC", "ARTISAN", "INTERN", "STOREMAN", null].map((r) => isStaffRole(r)), [true, true, true, false, false]);
});

test("the foreman or deputy of that place assigns, or an administrator", () => {
    assert.equal(mayAssign(person, false, "heavy"), true);
    assert.equal(mayAssign(person, false, "tyres"), false);
    assert.equal(mayAssign(person, true, "tyres"), true);
});

test("assigning waits for the place to accept the vehicle", () => {
    const at = (kind: string, received: boolean, left = false) => assignError({ kind: kind as never, name: "Heavy duty", received, left });
    assert.equal(at("WORKSHOP", true), null);
    assert.match(at("WORKSHOP", false)!, /must accept/);
    assert.match(at("CHECK_BAY", true)!, /not at reception or the check bay/);
    assert.match(at("WORKSHOP", true, true)!, /not at a workshop/);
    assert.match(assignError(null)!, /not at a workshop/);
});

test("the lead is the first assigned still on the job", () => {
    const t = (m: number) => new Date(2026, 10, 25, 9, m);
    assert.equal(leadOf([]), null);
    assert.equal(leadOf([{ membershipId: "b", assignedAt: t(5), removedAt: null }, { membershipId: "a", assignedAt: t(1), removedAt: null }]), "a");
    assert.equal(leadOf([{ membershipId: "a", assignedAt: t(1), removedAt: t(9) }, { membershipId: "b", assignedAt: t(5), removedAt: null }]), "b");
});
