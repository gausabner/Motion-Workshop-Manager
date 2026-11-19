import { test } from "node:test";
import type { JobSignRole } from "@prisma/client";
import assert from "node:assert/strict";
import {
    collected,
    currentVisit,
    issueMissing,
    lastWorkshop,
    mayAccept,
    maySend,
    maySign,
    moveError,
    nextPurposes,
    qualityOutcome,
    signError,
    DEFAULT_ISSUE_ROLES,
    type Person,
    type Visit,
} from "@/lib/fleet/route-rules";

const reception = { id: "reception", kind: "RECEPTION" as const };
const checkBay = { id: "check", kind: "CHECK_BAY" as const };
const heavy = { id: "heavy", kind: "WORKSHOP" as const };
const tyres = { id: "tyres", kind: "BAY" as const };
const visit = (workshopId: string, purpose: Visit["purpose"], received = true, left = false): Visit => ({ id: `${purpose}-${workshopId}`, workshopId, purpose, received, left });
const ok: { issueMissing: JobSignRole[]; assessed: boolean; quality: "PASSED" | "FAILED" | null; lastWorkshopId: string | null } = { issueMissing: [], assessed: true, quality: null, lastWorkshopId: null };

test("a vehicle goes reception, check bay, workshops, check bay, reception — and nowhere after", () => {
    assert.deepEqual(nextPurposes(null), ["INTAKE"]);
    assert.deepEqual(nextPurposes("INTAKE"), ["ASSESSMENT"]);
    assert.deepEqual(nextPurposes("ASSESSMENT"), ["WORK"]);
    assert.deepEqual(nextPurposes("WORK"), ["WORK", "QUALITY_CHECK"]);
    assert.deepEqual(nextPurposes("QUALITY_CHECK"), ["RELEASE", "WORK"]);
    assert.deepEqual(nextPurposes("RELEASE"), []);
});

test("where it is now is the stay not yet left; a failed check knows which workshop did the work", () => {
    const route = [visit("reception", "INTAKE", true, true), visit("check", "ASSESSMENT", true, true), visit("heavy", "WORK", true, true), visit("tyres", "WORK", true, true), visit("check", "QUALITY_CHECK")];
    assert.equal(currentVisit(route)?.purpose, "QUALITY_CHECK");
    assert.equal(lastWorkshop(route), "tyres");
});

test("each move goes to the right kind of place, and only once it has been accepted where it is", () => {
    assert.equal(moveError({ ...ok, current: null, purpose: "INTAKE", destination: reception }), null);
    assert.match(moveError({ ...ok, current: null, purpose: "ASSESSMENT", destination: checkBay })!, /Book it in/);
    assert.match(moveError({ ...ok, current: visit("reception", "INTAKE"), purpose: "ASSESSMENT", destination: heavy })!, /happens at check bay/);
    assert.match(moveError({ ...ok, current: visit("check", "ASSESSMENT", false), purpose: "WORK", destination: heavy })!, /not been accepted/);
    assert.match(moveError({ ...ok, current: visit("reception", "INTAKE"), purpose: "WORK", destination: heavy })!, /it goes to assessment/);
    assert.equal(moveError({ ...ok, current: visit("heavy", "WORK"), purpose: "WORK", destination: tyres }), null, "heavy duty, then the tyre bay");
    assert.match(moveError({ ...ok, current: visit("heavy", "WORK"), purpose: "WORK", destination: heavy })!, /already in that workshop/);
});

test("nothing leaves reception unsigned, the check bay unassessed, or the quality check unpassed", () => {
    assert.match(moveError({ ...ok, issueMissing: ["DRIVER", "FLEET_COORDINATOR"], current: visit("reception", "INTAKE"), purpose: "ASSESSMENT", destination: checkBay })!, /signing by driver, fleet coordinator/);
    assert.match(moveError({ ...ok, assessed: false, current: visit("check", "ASSESSMENT"), purpose: "WORK", destination: heavy })!, /not signed the assessment/);
    assert.match(moveError({ ...ok, quality: null, current: visit("check", "QUALITY_CHECK"), purpose: "RELEASE", destination: reception })!, /not passed/);
    assert.equal(moveError({ ...ok, quality: "PASSED", current: visit("check", "QUALITY_CHECK"), purpose: "RELEASE", destination: reception }), null);
});

test("a failed quality check sends it back to the workshop that did the work, and only a failed one", () => {
    const qc = visit("check", "QUALITY_CHECK");
    assert.match(moveError({ ...ok, quality: "PASSED", current: qc, purpose: "WORK", destination: heavy, lastWorkshopId: "heavy" })!, /Only a failed quality check/);
    assert.match(moveError({ ...ok, quality: "FAILED", current: qc, purpose: "WORK", destination: tyres, lastWorkshopId: "heavy" })!, /back to the workshop that did the work/);
    assert.equal(moveError({ ...ok, quality: "FAILED", current: qc, purpose: "WORK", destination: heavy, lastWorkshopId: "heavy" }), null);
});

test("the job card is complete when every signature the council's card asks for is on it", () => {
    const signed = [{ stage: "ISSUE" as const, role: "RECEPTION" as const, decision: "SIGNED" as const }, { stage: "ISSUE" as const, role: "DRIVER" as const, decision: "SIGNED" as const }];
    assert.deepEqual(issueMissing(signed, DEFAULT_ISSUE_ROLES), ["FOREMAN", "FLEET_COORDINATOR", "MECHANIC"]);
    assert.deepEqual(issueMissing(signed, ["RECEPTION", "DRIVER"]), [], "a council whose card asks for two");
});

test("the latest quality check decides, and collection takes the driver and reception", () => {
    const qc = (decision: "PASSED" | "FAILED") => ({ stage: "QUALITY_CHECK" as const, role: "INSPECTOR" as const, decision });
    assert.equal(qualityOutcome([qc("FAILED"), qc("PASSED")]), "PASSED");
    assert.equal(qualityOutcome([qc("PASSED"), qc("FAILED")]), "FAILED");
    assert.equal(qualityOutcome([]), null);
    const c = (role: "DRIVER" | "RECEPTION") => ({ stage: "COLLECTION" as const, role, decision: "SIGNED" as const });
    assert.equal(collected([c("DRIVER")]), false);
    assert.equal(collected([c("DRIVER"), c("RECEPTION")]), true);
});

test("those who work at a place send from it and accept at it; after assessment the receiving foreman may fetch it", () => {
    const receptionist: Person = { membershipId: "r", designations: ["RECEPTION"], foremanOf: [] };
    const checkForeman: Person = { membershipId: "c", designations: ["FOREMAN"], foremanOf: ["check"] };
    const heavyForeman: Person = { membershipId: "h", designations: ["FOREMAN"], foremanOf: ["heavy"] };
    assert.equal(maySend(receptionist, null, reception, "INTAKE"), true);
    assert.equal(maySend(receptionist, reception, checkBay, "ASSESSMENT"), true);
    assert.equal(maySend(heavyForeman, reception, checkBay, "ASSESSMENT"), false);
    assert.equal(maySend(checkForeman, checkBay, heavy, "WORK"), true, "the check bay sends it");
    assert.equal(maySend(heavyForeman, checkBay, heavy, "WORK"), true, "or the workshop's foreman fetches it");
    assert.equal(maySend(heavyForeman, checkBay, tyres, "WORK"), false, "but not for another workshop");
    assert.equal(mayAccept(heavyForeman, heavy), true);
    assert.equal(mayAccept(heavyForeman, checkBay), false);
    assert.equal(mayAccept(receptionist, reception), true);
});

test("each signature comes from the right person", () => {
    const p = (designations: Person["designations"], foremanOf: string[] = []): Person => ({ membershipId: "x", designations, foremanOf });
    assert.equal(maySign(p(["RECEPTION"]), "DRIVER", ["check"]), true, "reception records the driver");
    assert.equal(maySign(p(["MECHANIC"]), "DRIVER", ["check"]), false);
    assert.equal(maySign(p(["ARTISAN"]), "MECHANIC", ["check"]), true);
    assert.equal(maySign(p([], ["heavy"]), "FOREMAN", ["check"]), true);
    assert.equal(maySign(p(["FOREMAN"], ["heavy"]), "INSPECTOR", ["check"]), false, "only the check bay inspects");
    assert.equal(maySign(p(["FOREMAN"], ["check"]), "INSPECTOR", ["check"]), true);
});

test("at issue each box is signed once, by a different person each time, at reception", () => {
    const base = { stage: "ISSUE" as const, current: visit("reception", "INTAKE"), signatures: [], signerId: "me", required: DEFAULT_ISSUE_ROLES };
    assert.equal(signError({ ...base, role: "RECEPTION" }), null);
    const mine = [{ stage: "ISSUE" as const, role: "RECEPTION" as const, decision: "SIGNED" as const, membershipId: "me" }];
    assert.match(signError({ ...base, role: "RECEPTION", signatures: mine })!, /already signed/);
    assert.match(signError({ ...base, role: "FOREMAN", signatures: mine })!, /Another person signs this box/);
    assert.equal(signError({ ...base, role: "DRIVER", signatures: mine }), null, "reception records the driver as well as signing");
    assert.match(signError({ ...base, role: "INSPECTOR" })!, /does not sign at this stage/);
    assert.match(signError({ ...base, role: "MECHANIC", required: ["RECEPTION", "DRIVER"] })!, /does not ask for/);
    assert.match(signError({ ...base, role: "MECHANIC", current: visit("check", "ASSESSMENT") })!, /before the vehicle leaves it/);
});

test("the check bay signs at the check bay; the driver collects only what is ready", () => {
    const sign = (stage: "ASSESSMENT" | "QUALITY_CHECK" | "COLLECTION", current: Visit | null, role: "INSPECTOR" | "DRIVER" = "INSPECTOR") =>
        signError({ stage, role, current, signatures: [], signerId: "me", required: DEFAULT_ISSUE_ROLES });
    assert.equal(sign("ASSESSMENT", visit("check", "ASSESSMENT")), null);
    assert.match(sign("ASSESSMENT", visit("check", "ASSESSMENT", false))!, /not at the check bay/);
    assert.match(sign("QUALITY_CHECK", visit("heavy", "WORK"))!, /not at the check bay for its quality check/);
    assert.equal(sign("COLLECTION", visit("reception", "RELEASE"), "DRIVER"), null);
    assert.match(sign("COLLECTION", visit("check", "QUALITY_CHECK"), "DRIVER")!, /not at reception ready/);
});

test("time in a bay reads the way a workshop says it", async () => {
    const { duration } = await import("@/lib/fleet/format");
    assert.equal(duration(45), "45 min");
    assert.equal(duration(135), "2 h 15 min");
    assert.equal(duration(120), "2 h");
    assert.equal(duration(60 * 76), "3 d 4 h");
});
