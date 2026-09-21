import { test } from "node:test";
import assert from "node:assert/strict";
import { EDITABLE_TEMPLATES, defaultBodyFor } from "./catalogue";
import { unknownFields } from "./merge";

test("every built-in template uses only fields that exist", () => {
    for (const t of EDITABLE_TEMPLATES) assert.deepEqual(unknownFields(t.defaultBody), [], t.kind);
});

test("each template kind appears once, so a save cannot land on the wrong one", () => {
    const kinds = EDITABLE_TEMPLATES.map((t) => t.kind);
    assert.equal(new Set(kinds).size, kinds.length);
});

test("messages must say something; footers may be deliberately blank", () => {
    assert.equal(EDITABLE_TEMPLATES.filter((t) => t.group === "Sent with documents").every((t) => !t.allowEmpty), true);
    assert.equal(EDITABLE_TEMPLATES.filter((t) => t.group === "Printed on documents").every((t) => t.allowEmpty), true);
});

test("an unknown kind has no default rather than borrowing another's", () => {
    assert.equal(defaultBodyFor("SMS"), "");
});
