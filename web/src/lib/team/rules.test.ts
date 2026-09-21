import { test } from "node:test";
import assert from "node:assert/strict";
import { flagsForGroup, invitableGroups, memberChangeError, type MemberSnapshot } from "./rules";

const owner: MemberSnapshot = { id: "o1", group: "OWNER", status: "ACTIVE" };
const owner2: MemberSnapshot = { id: "o2", group: "OWNER", status: "ACTIVE" };
const admin: MemberSnapshot = { id: "a1", group: "ADMIN", status: "ACTIVE" };
const mech: MemberSnapshot = { id: "m1", group: "MECHANIC", status: "ACTIVE" };

test("an admin can change a mechanic", () => {
    assert.equal(memberChangeError(admin, mech, { group: "SERVICE_ADVISOR", status: "ACTIVE" }, 1), null);
    assert.equal(memberChangeError(admin, mech, { group: "MECHANIC", status: "INACTIVE" }, 1), null);
});

test("an admin cannot promote anyone to owner, or touch an owner", () => {
    assert.match(memberChangeError(admin, mech, { group: "OWNER", status: "ACTIVE" }, 1)!, /Only an owner/);
    assert.match(memberChangeError(admin, owner, { group: "ADMIN", status: "ACTIVE" }, 2)!, /Only an owner/);
});

test("nobody changes their own role or status", () => {
    assert.match(memberChangeError(admin, admin, { group: "OWNER", status: "ACTIVE" }, 1)!, /Only an owner/);
    assert.match(memberChangeError(admin, admin, { group: "ADMIN", status: "INACTIVE" }, 1)!, /own role/);
    assert.match(memberChangeError(owner, owner, { group: "ADMIN", status: "ACTIVE" }, 2)!, /own role/);
    assert.equal(memberChangeError(owner, owner, { group: "OWNER", status: "ACTIVE" }, 1), null, "saving flags only is fine");
});

test("the last active owner cannot be removed", () => {
    assert.match(memberChangeError(owner, owner2, { group: "ADMIN", status: "ACTIVE" }, 1)!, /at least one active owner/);
    assert.equal(memberChangeError(owner, owner2, { group: "ADMIN", status: "ACTIVE" }, 2), null);
    assert.equal(memberChangeError(owner, owner2, { group: "OWNER", status: "INACTIVE" }, 2), null);
});

test("roles bring their flags; only owners hand out owner", () => {
    assert.deepEqual(flagsForGroup("MECHANIC"), { isMechanic: true, showOnDiary: true, isServiceAdvisor: false });
    assert.equal(flagsForGroup("SERVICE_ADVISOR").isServiceAdvisor, true);
    assert.ok(invitableGroups("OWNER").includes("OWNER"));
    assert.ok(!invitableGroups("ADMIN").includes("OWNER"));
});
