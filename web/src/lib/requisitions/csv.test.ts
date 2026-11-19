import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVoteCsv } from "@/lib/requisitions/csv";

test("votes are read as the finance system writes them, leading zeros and all", () => {
    const { rows, errors } = parseVoteCsv("Vote,Name,Unit\n0200025105010,Protective clothing,Fleet Management\n2000031204020,Vehicle maintenance,Parks\n");
    assert.deepEqual(errors, []);
    assert.deepEqual(rows.map((r) => [r.code, r.name, r.unit]), [
        ["0200025105010", "Protective clothing", "Fleet Management"],
        ["2000031204020", "Vehicle maintenance", "Parks"],
    ]);
});

test("a semicolon export and quoted names with commas both read", () => {
    const { rows } = parseVoteCsv('2000031204020;"Parks; vehicles, plant and tools";Parks');
    assert.deepEqual(rows.map((r) => r.name), ["Parks; vehicles, plant and tools"]);
    const comma = parseVoteCsv('2000031204020,"Vehicles, plant and tools",Parks');
    assert.equal(comma.rows[0].name, "Vehicles, plant and tools");
});

test("each problem names its line, and a repeated code is caught", () => {
    const { rows, errors } = parseVoteCsv("100,Fuel,Parks\n\n200,,Parks\n300,Tyres,\n100,Fuel again,Parks");
    assert.deepEqual(rows.map((r) => r.code), ["100"]);
    assert.deepEqual(errors, [
        { line: 3, message: "Vote 200 has no name." },
        { line: 4, message: "Vote 300 names no unit of the organisation." },
        { line: 5, message: "Vote 100 is already on line 1." },
    ]);
});
