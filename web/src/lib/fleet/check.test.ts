import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOutcome, checkProgress, checkSignError, checkSummary, type CheckItem } from "@/lib/fleet/check-rules";

/** The check bay's two inspections: what counts as checked, what passes, and what the signature says. */

const item = (description: string, mark: "ok" | "soon" | "urgent" | "none", comment: string | null = null): CheckItem => ({
    description,
    checked: mark !== "none",
    soon: mark === "soon",
    urgent: mark === "urgent",
    comment,
});

test("an item counts as checked once it is marked OK, Soon or Urgent", () => {
    const items = [item("Brakes", "ok"), item("Tyres", "soon"), item("Lights", "urgent"), item("Wipers", "none")];
    assert.deepEqual(checkProgress(items), { total: 4, left: 1, red: 1, amber: 1 });
    // An urgent flag alone is a check, even if the checked box was never ticked.
    assert.equal(checkProgress([{ ...item("Horn", "none"), urgent: true }]).left, 0);
});

test("a quality check has no outcome until every item is checked, then fails on any red", () => {
    assert.equal(checkOutcome([item("Brakes", "ok"), item("Wheel nuts", "none")]), null);
    assert.equal(checkOutcome([item("Brakes", "ok"), item("Tyres", "soon")]), "PASSED");
    assert.equal(checkOutcome([item("Brakes", "ok"), item("Wheel nuts", "urgent")]), "FAILED");
});

test("the signature says what the check found, in a line a foreman reads", () => {
    const failed = [item("Wheel nuts", "urgent", "not torqued"), item("Brakes", "ok"), item("Door seal", "urgent")];
    assert.equal(checkSummary("QUALITY_CHECK", failed), "Wheel nuts: not torqued; Door seal");
    assert.equal(checkSummary("QUALITY_CHECK", [item("Brakes", "ok"), item("Lights", "ok")]), "2 items checked");
    const findings = [item("Brake pads", "urgent", "2 mm left"), item("Wipers", "soon"), item("Lights", "ok")];
    assert.equal(checkSummary("ASSESSMENT", findings), "1 urgent, 1 soon: Brake pads: 2 mm left; Wipers");
    assert.equal(checkSummary("ASSESSMENT", [item("Lights", "ok")]), "Nothing found, 1 item checked");
    const long = Array.from({ length: 40 }, (_, n) => item(`Item number ${n}`, "urgent"));
    assert.equal(checkSummary("QUALITY_CHECK", long).length, 300, "capped at the signature's length");
});

test("the check bay signs only an inspection it has finished, and only starts one when a template is chosen", () => {
    assert.match(checkSignError("ASSESSMENT", true, null) ?? "", /Start the assessment first/);
    assert.equal(checkSignError("ASSESSMENT", false, null), null, "no template chosen: a plain signature with a note");
    assert.match(checkSignError("QUALITY_CHECK", true, [item("Brakes", "ok"), item("Lights", "none")]) ?? "", /1 of 2 is not checked/);
    assert.equal(checkSignError("QUALITY_CHECK", false, [item("Brakes", "ok")]), null);
});
