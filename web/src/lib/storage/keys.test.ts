import { test } from "node:test";
import assert from "node:assert/strict";
import { buildKey, extensionFor, isSafeKey, safeFileName, uploadError, MAX_UPLOAD_BYTES } from "./keys";

test("a key cannot climb out of its prefix", () => {
    assert.equal(isSafeKey("t/abc/payment-tender/xyz/1.pdf"), true);
    assert.equal(isSafeKey("../../etc/passwd"), false);
    assert.equal(isSafeKey("t/abc/../../../etc/passwd"), false);
    assert.equal(isSafeKey("/t/abc/1.pdf"), false);
    assert.equal(isSafeKey("t//abc/1.pdf"), false);
    assert.equal(isSafeKey("t/abc/"), false);
    assert.equal(isSafeKey("t/ABC/1.pdf"), false);
    assert.equal(isSafeKey(""), false);
});

test("the extension comes from the declared type, not the file name", () => {
    assert.equal(extensionFor("application/pdf"), "pdf");
    assert.equal(extensionFor("image/jpeg; charset=binary"), "jpg");
    assert.equal(extensionFor("IMAGE/PNG"), "png");
    assert.equal(extensionFor("application/x-msdownload"), null);
    assert.equal(extensionFor("text/html"), null);
});

test("a file name keeps its shape but loses anything path-like", () => {
    assert.equal(safeFileName("../../proof.pdf"), "proof.pdf");
    assert.equal(safeFileName("C:\\Users\\me\\eft slip.pdf"), "eft slip.pdf");
    assert.equal(safeFileName('proof"1".pdf'), "proof1.pdf");
    // A backslash is a separator, because that is how Windows browsers send a path.
    assert.equal(safeFileName("odd\\name.pdf"), "name.pdf");
    assert.equal(safeFileName("   "), "attachment");
});

test("keys are built inside one tenant's subtree", () => {
    const key = buildKey({ tenantId: "cmTenant01", ownerType: "PaymentTender", ownerId: "cmTender01", id: "cmFile01", extension: "pdf" });
    assert.equal(key, "t/cmtenant01/paymenttender/cmtender01/cmfile01.pdf");
    assert.equal(isSafeKey(key), true);
});

test("uploads are refused by size and by kind, with a reason a person can act on", () => {
    assert.equal(uploadError({ size: 2048, type: "application/pdf", name: "proof.pdf" }), null);
    assert.match(uploadError({ size: 0, type: "application/pdf", name: "proof.pdf" }) ?? "", /empty/);
    assert.match(uploadError({ size: MAX_UPLOAD_BYTES + 1, type: "application/pdf", name: "proof.pdf" }) ?? "", /limit is 10 MB/);
    assert.match(uploadError({ size: 10, type: "text/html", name: "sneaky.html" }) ?? "", /not a kind of file we store/);
});
