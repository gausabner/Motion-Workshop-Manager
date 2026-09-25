import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, zip } from "./zip";

/**
 * A hand-written ZIP, checked by something that did not write it.
 *
 * Testing an archive by reading it back with the same code that produced it
 * proves only that the code agrees with itself — which a format this fiddly
 * will do right up until somebody opens the file in Windows Explorer. So the
 * real assertion here runs the system `unzip`, and the round-trip tests are
 * the cheap ones underneath it.
 */

const canUnzip = (() => {
    try {
        execFileSync("unzip", ["-v"], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
})();

function writeArchive(entries: { name: string; body: string }[]): string {
    const dir = mkdtempSync(join(tmpdir(), "motion-zip-"));
    const path = join(dir, "bundle.zip");
    writeFileSync(path, zip(entries));
    return path;
}

test("the checksum is the one the format specifies, not one of our own", () => {
    // The well-known CRC-32 of "123456789". If this is wrong, every archive is
    // readable right up to the point something verifies it.
    assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
    assert.equal(crc32(Buffer.from("")), 0);
});

test("a real unzip opens it, and finds every file intact", { skip: !canUnzip && "no unzip on this machine" }, () => {
    const path = writeArchive([
        { name: "customers.csv", body: "Name,City\r\nFarrell,Windhoek\r\n" },
        { name: "vehicles.csv", body: "Plate\r\nN 12345 W\r\n" },
    ]);
    // -t verifies every entry's checksum, which is the whole point of running it.
    const tested = execFileSync("unzip", ["-t", path], { encoding: "utf8" });
    assert.ok(tested.includes("No errors detected"), tested);

    const listed = execFileSync("unzip", ["-Z1", path], { encoding: "utf8" });
    assert.deepEqual(listed.trim().split("\n").sort(), ["customers.csv", "vehicles.csv"]);

    const content = execFileSync("unzip", ["-p", path, "customers.csv"], { encoding: "utf8" });
    assert.equal(content, "Name,City\r\nFarrell,Windhoek\r\n");
});

test("a file that would grow when compressed is stored as it is", { skip: !canUnzip && "no unzip on this machine" }, () => {
    // Four bytes of noise deflate longer than they started. Handing somebody an
    // archive bigger than its contents is a silly way to prove a point.
    const path = writeArchive([{ name: "tiny.csv", body: "a,b\n" }]);
    assert.ok(execFileSync("unzip", ["-t", path], { encoding: "utf8" }).includes("No errors detected"));
    assert.equal(execFileSync("unzip", ["-p", path, "tiny.csv"], { encoding: "utf8" }), "a,b\n");
});

test("something long and repetitive actually compresses", () => {
    const body = "Date,Number,Customer\r\n".repeat(2000);
    const archive = zip([{ name: "sales.csv", body }]);
    assert.ok(archive.length < body.length / 4, `${archive.length} against ${body.length}`);
});

test("a name outside ASCII is written as UTF-8 and flagged as such", () => {
    // Worth knowing rather than worth relying on: the archive is correct here —
    // Python's zipfile, which honours the flag, reads the name back exactly —
    // but the Info-ZIP build macOS ships ignores bit 11 and renders it as
    // `caf+?-donn+?es.csv`, then refuses to extract it. Two readers, one
    // spec-compliant. That is the reason the bundle names its entries after
    // database tables and keeps them ASCII: being right is not much comfort
    // when the council's laptop cannot open the file.
    const archive = zip([{ name: "café.csv", body: "x\n" }]);
    assert.equal(archive.readUInt16LE(6) & 0x0800, 0x0800, "the UTF-8 name flag is set");
    assert.ok(archive.includes(Buffer.from("café.csv", "utf8")), "and the name is UTF-8 bytes");
});

test("an empty bundle is a valid archive rather than a broken file", () => {
    // Just the end-of-central-directory record: 22 bytes, no entries. Info-ZIP
    // calls this "Empty zipfile" and exits non-zero, which is its opinion
    // rather than a defect, so this is checked against the format instead.
    const archive = zip([]);
    assert.equal(archive.length, 22);
    assert.equal(archive.readUInt32LE(0), 0x06054b50);
    assert.equal(archive.readUInt16LE(8), 0, "no entries");
});

test("too many entries is refused rather than silently truncated to a number that fits", () => {
    const many = Array.from({ length: 70_000 }, (_, i) => ({ name: `f${i}.csv`, body: "x" }));
    assert.throws(() => zip(many), /holds 65535 entries/);
});
