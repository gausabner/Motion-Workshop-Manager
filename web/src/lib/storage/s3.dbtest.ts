import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { S3Driver } from "@/lib/storage/s3";
import { ObjectNotFound } from "@/lib/storage/types";
import { authorizationHeader, amzDate, sha256 } from "@/lib/storage/sigv4";
import { buildKey } from "@/lib/storage/keys";
import { driverNamed, resetDriversForTest } from "@/lib/storage";

/**
 * The S3 driver against a real S3 server.
 *
 * SigV4 here is hand-written and was checked against AWS's own worked example,
 * which proves the arithmetic and nothing else: a signature can be perfect and
 * the request still wrong — the wrong host header, a path-style URL a bucket
 * rejects, a key whose spaces were encoded twice. Only a server that refuses
 * you can tell you that.
 *
 * MinIO speaks the same protocol as AWS S3, Cloudflare R2, Backblaze B2 and
 * DigitalOcean Spaces, and runs in a container with throwaway credentials, so
 * this test needs nobody's real bucket:
 *
 *   docker run -d --name zztest-minio -p 9100:9000 \
 *     -e MINIO_ROOT_USER=zztestkey -e MINIO_ROOT_PASSWORD=zztestsecret123 \
 *     quay.io/minio/minio:latest server /data
 *
 * Skipped when nothing is listening, so it never breaks a run for somebody who
 * has not started it.
 */

const ENDPOINT = process.env.ZZTEST_S3_ENDPOINT ?? "http://localhost:9100";
const BUCKET = "zztest-motion";
const CONFIG = {
    endpoint: ENDPOINT,
    bucket: BUCKET,
    region: "us-east-1",
    accessKeyId: process.env.ZZTEST_S3_KEY ?? "zztestkey",
    secretAccessKey: process.env.ZZTEST_S3_SECRET ?? "zztestsecret123",
    forcePathStyle: true,
};

const driver = new S3Driver(CONFIG);

/** Create the bucket with a signed request of our own, which exercises the signing too. */
async function makeBucket(): Promise<void> {
    const at = new Date();
    const url = new URL(ENDPOINT);
    const path = `/${BUCKET}`;
    const payloadHash = sha256("");
    const headers: Record<string, string> = {
        host: url.host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate(at),
    };
    headers.Authorization = authorizationHeader({
        method: "PUT", path, headers, payloadHash, at,
        region: CONFIG.region, service: "s3",
        accessKeyId: CONFIG.accessKeyId, secretAccessKey: CONFIG.secretAccessKey,
    });
    const response = await fetch(`${url.origin}${path}`, { method: "PUT", headers });
    // 409 is "you already made it", which is fine.
    if (!response.ok && response.status !== 409) {
        throw new Error(`Could not create the test bucket: ${response.status} ${await response.text()}`);
    }
}

let live = false;

before(async () => {
    live = await fetch(`${ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(2000) })
        .then((r) => r.ok)
        .catch(() => false);
    if (live) await makeBucket();
});

after(async () => {
    if (!live) return;
    for (const key of ["tenant-a/proof/eft.pdf", "tenant-a/proof/big.bin", "tenant-a/proof/overwrite.txt"]) {
        await driver.delete(key).catch(() => undefined);
    }
});

/**
 * Skipped at run time rather than with the `skip` option: node:test evaluates
 * that option when it registers the test, which is before any hook has had a
 * chance to find out whether the server is there.
 */
function withoutServer(t: { skip: (reason: string) => void }): boolean {
    if (live) return false;
    t.skip("MinIO is not running — see the comment at the top of this file");
    return true;
}

test("a file goes up, comes back byte for byte, and can be taken away", async (t) => {
    if (withoutServer(t)) return;
    const key = "tenant-a/proof/eft.pdf";
    const body = Buffer.from("%PDF-1.4\nproof of payment\n%%EOF\n", "utf8");

    await driver.put(key, body, { contentType: "application/pdf", fileName: "eft.pdf" });
    assert.equal(await driver.exists(key), true, "the bucket says it is there");

    const back = await driver.get(key);
    assert.deepEqual(back, body, "the same bytes came back");

    await driver.delete(key);
    assert.equal(await driver.exists(key), false, "and it is gone");
});

test("reading something that is not there says so plainly", async (t) => {
    if (withoutServer(t)) return;
    await assert.rejects(() => driver.get("tenant-a/proof/never-existed.pdf"), ObjectNotFound);
});

test("deleting something that is not there is not an error", async (t) => {
    if (withoutServer(t)) return;
    // A retried delete, or a record whose file was already swept, must not raise.
    await driver.delete("tenant-a/proof/never-existed.pdf");
});

test("a real key, of the shape the app actually builds, round trips", async (t) => {
    if (withoutServer(t)) return;
    // Double-encoding a key is the classic SigV4 mistake: the signature covers
    // the path we encoded and the bucket then looks for a different object.
    // It cannot bite here, and that is worth pinning down rather than assuming:
    // keys are built by `buildKey`, never taken from a filename, and every
    // character they may contain is unreserved in AWS's encoding rules. The
    // name the customer sees travels separately, as `fileName`.
    const key = buildKey({ tenantId: "cmtmy0dzg0000pa5b", ownerType: "Payment", ownerId: "cmu2mgyli0007pafa", id: "cmu6poheu000hpadj", extension: "pdf" });
    assert.match(key, /^t\/[a-z0-9-]+\/payment\/[a-z0-9-]+\/[a-z0-9-]+\.pdf$/);

    const body = Buffer.from("%PDF-1.4\nan actual attachment\n%%EOF\n", "utf8");
    await driver.put(key, body, { contentType: "application/pdf", fileName: "Proof of payment (Sept).pdf" });
    assert.deepEqual(await driver.get(key), body);
    await driver.delete(key);
});

test("a key with a space or an accent never reaches the bucket at all", async (t) => {
    if (withoutServer(t)) return;
    // Refused by the key rules rather than encoded and hoped for. The app
    // cannot produce one of these; a caller that hand-rolled a key could.
    for (const bad of ["t/a/payment/b/a file with spaces.pdf", "t/a/payment/b/über.pdf", "T/A/Payment/B/c.pdf"]) {
        await assert.rejects(() => driver.put(bad, Buffer.from("x"), { contentType: "application/pdf" }), /Unsafe storage key/, bad);
    }
});

test("a file large enough to be a real scan is not truncated", async (t) => {
    if (withoutServer(t)) return;
    const key = "tenant-a/proof/big.bin";
    // 5 MB of non-repeating bytes: a photographed proof of payment is this size,
    // and a length or streaming bug shows up as a short read.
    const body = Buffer.alloc(5 * 1024 * 1024);
    for (let i = 0; i < body.length; i++) body[i] = (i * 31 + 7) % 251;

    await driver.put(key, body, { contentType: "application/octet-stream" });
    const back = await driver.get(key);
    assert.equal(back.byteLength, body.byteLength, "the whole thing came back");
    assert.equal(sha256(back), sha256(body), "and it is the same thing");
    await driver.delete(key);
});

test("writing the same key twice replaces it", async (t) => {
    if (withoutServer(t)) return;
    const key = "tenant-a/proof/overwrite.txt";
    await driver.put(key, Buffer.from("first", "utf8"), { contentType: "text/plain" });
    await driver.put(key, Buffer.from("second", "utf8"), { contentType: "text/plain" });
    assert.equal((await driver.get(key)).toString("utf8"), "second");
    await driver.delete(key);
});

test("a wrong secret is refused, so a misconfigured deployment fails loudly", async (t) => {
    if (withoutServer(t)) return;
    const wrong = new S3Driver({ ...CONFIG, secretAccessKey: "not-the-secret" });
    await assert.rejects(
        () => wrong.put("tenant-a/proof/eft.pdf", Buffer.from("x"), { contentType: "text/plain" }),
        (error: Error) => error.name === "StorageError" && !(error instanceof ObjectNotFound),
        "bad credentials must raise, not silently do nothing",
    );
});

test("a key that tries to climb out of its folder is refused before any request", async (t) => {
    if (withoutServer(t)) return;
    await assert.rejects(() => driver.get("tenant-a/../tenant-b/secret.pdf"));
});

test("the driver a deployment gets from its environment is the one that works", async (t) => {
    if (withoutServer(t)) return;
    // The other half of what had never been exercised: the config plumbing. A
    // deployment sets six environment variables and trusts that what comes out
    // can talk to its bucket. `forcePathStyle` in particular is a string in the
    // environment and a boolean in the config, and MinIO refuses without it.
    process.env.STORAGE_S3_ENDPOINT = ENDPOINT;
    process.env.STORAGE_S3_BUCKET = BUCKET;
    process.env.STORAGE_S3_REGION = CONFIG.region;
    process.env.STORAGE_S3_ACCESS_KEY_ID = CONFIG.accessKeyId;
    process.env.STORAGE_S3_SECRET_ACCESS_KEY = CONFIG.secretAccessKey;
    process.env.STORAGE_S3_FORCE_PATH_STYLE = "true";

    resetDriversForTest();
    const fromEnv = driverNamed("s3");
    assert.equal(fromEnv.name, "s3", "and every stored object records that name, which is what survives a driver switch");

    const key = buildKey({ tenantId: "cmtmy0dzg0000pa5b", ownerType: "Attachment", ownerId: "env", id: "wiring", extension: "pdf" });
    const body = Buffer.from("configured from the environment", "utf8");
    await fromEnv.put(key, body, { contentType: "application/pdf" });
    assert.deepEqual(await fromEnv.get(key), body);
    await fromEnv.delete(key);
});

test("a deployment missing a setting is told which one", async () => {
    // No server needed: this is the failure a first deploy actually hits.
    const saved = process.env.STORAGE_S3_BUCKET;
    delete process.env.STORAGE_S3_BUCKET;
    resetDriversForTest();
    try {
        assert.throws(() => driverNamed("s3"), /STORAGE_S3_BUCKET is not set/);
    } finally {
        if (saved !== undefined) process.env.STORAGE_S3_BUCKET = saved;
        resetDriversForTest();
    }
});
