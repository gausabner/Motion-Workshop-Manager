import { test } from "node:test";
import assert from "node:assert/strict";
import { amzDate, authorizationHeader, canonicalRequest, sha256, signingKey, stringToSign, uriEncode } from "./sigv4";

/**
 * AWS publishes a worked example for GET Object on `examplebucket`. Checking
 * every step against it is the only way to know hand-rolled signing is right
 * before a real bucket is ever pointed at.
 * https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
 */
const EXAMPLE = {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1",
    service: "s3",
    at: new Date("2013-05-24T00:00:00Z"),
    emptyBody: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
};

test("the date stamps are the compact form AWS wants", () => {
    assert.equal(amzDate(EXAMPLE.at), "20130524T000000Z");
});

test("an empty body hashes to the well-known sha256", () => {
    assert.equal(sha256(""), EXAMPLE.emptyBody);
});

test("uri encoding leaves the unreserved set alone and escapes the rest", () => {
    assert.equal(uriEncode("a/b c.txt", false), "a/b%20c.txt");
    assert.equal(uriEncode("a/b", true), "a%2Fb");
    assert.equal(uriEncode("~-._"), "~-._");
    assert.equal(uriEncode("é"), "%C3%A9");
});

test("the canonical request matches AWS's worked example", () => {
    const { text, signedHeaders } = canonicalRequest({
        method: "GET",
        path: "/test.txt",
        headers: {
            Host: "examplebucket.s3.amazonaws.com",
            Range: "bytes=0-9",
            "x-amz-content-sha256": EXAMPLE.emptyBody,
            "x-amz-date": "20130524T000000Z",
        },
        payloadHash: EXAMPLE.emptyBody,
    });
    assert.equal(signedHeaders, "host;range;x-amz-content-sha256;x-amz-date");
    assert.equal(
        text,
        [
            "GET",
            "/test.txt",
            "",
            "host:examplebucket.s3.amazonaws.com",
            "range:bytes=0-9",
            `x-amz-content-sha256:${EXAMPLE.emptyBody}`,
            "x-amz-date:20130524T000000Z",
            "",
            "host;range;x-amz-content-sha256;x-amz-date",
            EXAMPLE.emptyBody,
        ].join("\n"),
    );
});

test("the string to sign matches AWS's worked example", () => {
    const { text } = canonicalRequest({
        method: "GET",
        path: "/test.txt",
        headers: {
            Host: "examplebucket.s3.amazonaws.com",
            Range: "bytes=0-9",
            "x-amz-content-sha256": EXAMPLE.emptyBody,
            "x-amz-date": "20130524T000000Z",
        },
        payloadHash: EXAMPLE.emptyBody,
    });
    assert.equal(
        stringToSign(EXAMPLE.at, EXAMPLE.region, EXAMPLE.service, text),
        [
            "AWS4-HMAC-SHA256",
            "20130524T000000Z",
            "20130524/us-east-1/s3/aws4_request",
            "7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972",
        ].join("\n"),
    );
});

test("the signing key derivation matches AWS's worked example", () => {
    assert.equal(
        signingKey(EXAMPLE.secretAccessKey, EXAMPLE.at, EXAMPLE.region, EXAMPLE.service).toString("hex"),
        "dbb893acc010964918f1fd433add87c70e8b0db6be30c1fbeafefa5ec6ba8378",
    );
});

test("the authorization header matches AWS's worked example end to end", () => {
    const header = authorizationHeader({
        method: "GET",
        path: "/test.txt",
        headers: {
            Host: "examplebucket.s3.amazonaws.com",
            Range: "bytes=0-9",
            "x-amz-content-sha256": EXAMPLE.emptyBody,
            "x-amz-date": "20130524T000000Z",
        },
        payloadHash: EXAMPLE.emptyBody,
        region: EXAMPLE.region,
        service: EXAMPLE.service,
        accessKeyId: EXAMPLE.accessKeyId,
        secretAccessKey: EXAMPLE.secretAccessKey,
        at: EXAMPLE.at,
    });
    assert.equal(
        header,
        "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, " +
            "SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, " +
            "Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
});
