import { test } from "node:test";
import assert from "node:assert/strict";
import { flatten, freeName, move, parseReadings, templateDraftSchema, toGroups } from "./template-rules";

const item = (description: string, extra: object = {}) => ({ description, inputs: [], productId: null, defaultEstimate: null, ...extra });

test("groups flatten in order and come back the same", () => {
    const draft = templateDraftSchema.parse({
        name: "Pre-trip",
        groups: [
            { name: "Brakes", items: [item("Pads", { id: "a", inputs: ["L mm", "R mm"], defaultEstimate: 1850 }), item("Fluid", { id: "b" })] },
            { name: "Tyres", items: [item("Tread", { id: "c" })] },
        ],
    });
    const rows = flatten(draft);
    assert.deepEqual(rows.map((r) => [r.group, r.ordering, r.description]), [["Brakes", 0, "Pads"], ["Brakes", 1, "Fluid"], ["Tyres", 2, "Tread"]]);
    const back = toGroups(rows.map((r) => ({ ...r, id: r.id! })));
    assert.deepEqual(back, draft.groups);
});

test("stored rows out of order still group where each group first appears", () => {
    const g = toGroups([
        { id: "2", group: "Tyres", ordering: 5, description: "Tread", inputLabels: [], productId: null, defaultEstimate: null },
        { id: "1", group: "Brakes", ordering: 1, description: "Pads", inputLabels: ["L", 7, "R"], productId: null, defaultEstimate: null },
    ]);
    assert.deepEqual(g.map((x) => x.name), ["Brakes", "Tyres"]);
    assert.deepEqual(g[0].items[0].inputs, ["L", "R"], "non-strings in stored JSON are dropped");
});

test("the draft is refused when it would make a broken inspection", () => {
    const bad = (groups: unknown, name = "Service") => templateDraftSchema.safeParse({ name, groups }).success;
    assert.equal(bad([]), false, "no groups");
    assert.equal(bad([{ name: "Brakes", items: [] }]), false, "empty group");
    assert.equal(bad([{ name: "Brakes", items: [item("Pads")] }, { name: "brakes", items: [item("Discs")] }]), false, "duplicate group names");
    assert.equal(bad([{ name: "B", items: [item("Pads", { inputs: ["1", "2", "3", "4", "5"] })] }]), false, "five readings");
    assert.equal(bad([{ name: "B", items: [item("Pads", { defaultEstimate: -1 })] }]), false, "negative price");
    assert.equal(bad([{ name: "B", items: [item("Pads", { id: "x" }), item("Disc", { id: "x" })] }]), false, "same check twice");
    assert.equal(bad([{ name: "B", items: [item("Pads")] }], "  "), false, "blank name");
    assert.equal(bad([{ name: "B", items: [item("Pads")] }]), true);
});

test("readings, moves and copy names", () => {
    assert.deepEqual(parseReadings(" FL mm, FR mm,, RL mm , RR mm, spare"), ["FL mm", "FR mm", "RL mm", "RR mm"]);
    assert.deepEqual(move(["a", "b", "c"], 0, 1), ["b", "a", "c"]);
    assert.deepEqual(move(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
    assert.equal(freeName("Copy of Service", ["copy of service", "Copy of Service (2)"]), "Copy of Service (3)");
    assert.equal(freeName("Pre-trip", ["Service"]), "Pre-trip");
});
