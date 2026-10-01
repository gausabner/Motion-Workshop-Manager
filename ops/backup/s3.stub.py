#!/usr/bin/env python3
"""An S3-compatible bucket, on disk, for the end-to-end backup test.

This is not a mock that says yes. It recomputes the AWS Signature Version 4 of
every request from scratch, in a different language and a different
implementation from the shell client under test, and returns 403 when they
disagree. It also rechecks the payload hash against the body it actually
received. So a test that passes against this stub has proved the signing is
right, not merely that something accepted it.

MinIO would be the usual way to do this, and the first choice — but neither
Docker Hub nor quay would serve the image, and a backup system is not
something to ship unexercised because a registry was down.

    python3 s3.stub.py <root-dir> <port> <access-key> <secret-key>
"""

import hashlib
import hmac
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from xml.sax.saxutils import escape

ROOT, PORT, ACCESS_KEY, SECRET_KEY = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
REGION = os.environ.get("STUB_REGION", "auto")


def sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def expected_signature(method, path, query, headers, payload_hash, stamp, day):
    canonical = "\n".join([
        method,
        path,
        query,
        f"host:{headers['host']}",
        f"x-amz-content-sha256:{payload_hash}",
        f"x-amz-date:{stamp}",
        "",
        "host;x-amz-content-sha256;x-amz-date",
        payload_hash,
    ])
    scope = f"{day}/{REGION}/s3/aws4_request"
    to_sign = "\n".join([
        "AWS4-HMAC-SHA256", stamp, scope,
        hashlib.sha256(canonical.encode()).hexdigest(),
    ])
    k = sign(f"AWS4{SECRET_KEY}".encode(), day)
    for part in (REGION, "s3", "aws4_request"):
        k = sign(k, part)
    return hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest(), canonical


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):  # keep the test output readable
        pass

    def fail(self, code, message, detail=""):
        body = f"<Error><Code>{escape(message)}</Code><Message>{escape(detail)}</Message></Error>".encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/xml")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorise(self, body: bytes):
        """Returns (path, query) on success, or None having already replied."""
        raw = self.path
        path, _, query = raw.partition("?")
        auth = self.headers.get("Authorization", "")
        stamp = self.headers.get("x-amz-date", "")
        claimed_hash = self.headers.get("x-amz-content-sha256", "")

        if not auth.startswith("AWS4-HMAC-SHA256 "):
            self.fail(403, "AccessDenied", "no sigv4 Authorization header")
            return None
        if f"Credential={ACCESS_KEY}/" not in auth:
            self.fail(403, "InvalidAccessKeyId", auth)
            return None
        if "SignedHeaders=host;x-amz-content-sha256;x-amz-date," not in auth:
            self.fail(403, "AccessDenied", f"unexpected signed header set: {auth}")
            return None

        actual_hash = hashlib.sha256(body).hexdigest()
        if claimed_hash != actual_hash:
            self.fail(400, "XAmzContentSHA256Mismatch",
                      f"header said {claimed_hash}, body hashes to {actual_hash}")
            return None

        headers = {"host": self.headers.get("Host", "")}
        want, canonical = expected_signature(
            self.command, path, query, headers, claimed_hash, stamp, stamp[:8])
        got = auth.rsplit("Signature=", 1)[-1]
        if not hmac.compare_digest(want, got):
            self.fail(403, "SignatureDoesNotMatch",
                      f"canonical request was:\n{canonical}\nexpected {want}, got {got}")
            return None
        return path, query

    def object_path(self, path):
        # Path-style: /<bucket>/<key>. The key is percent-encoded on the wire.
        parts = path.lstrip("/").split("/", 1)
        if len(parts) < 2 or not parts[1]:
            return None
        key = urllib.parse.unquote(parts[1])
        if ".." in key.split("/"):
            return None
        return os.path.join(ROOT, key)

    def do_PUT(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0) or 0))
        ok = self.authorise(body)
        if not ok:
            return
        target = self.object_path(ok[0])
        if target is None:
            return self.fail(400, "InvalidRequest", "no key in path")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "wb") as f:
            f.write(body)
        self.send_response(200)
        self.send_header("ETag", f'"{hashlib.md5(body).hexdigest()}"')
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_DELETE(self):
        ok = self.authorise(b"")
        if not ok:
            return
        target = self.object_path(ok[0])
        if target and os.path.exists(target):
            os.remove(target)
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        ok = self.authorise(b"")
        if not ok:
            return
        path, query = ok
        params = urllib.parse.parse_qs(query)
        if params.get("list-type") == ["2"]:
            return self.list_objects(params.get("prefix", [""])[0],
                                     params.get("continuation-token", [None])[0])
        target = self.object_path(path)
        if target is None or not os.path.isfile(target):
            return self.fail(404, "NoSuchKey", path)
        with open(target, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def list_objects(self, prefix, token):
        keys = []
        for base, _, files in os.walk(ROOT):
            for name in files:
                key = os.path.relpath(os.path.join(base, name), ROOT)
                if key.startswith(prefix):
                    keys.append(key)
        keys.sort()

        # Page at two keys, so the test exercises continuation rather than
        # assuming a bucket is always small enough to come back in one reply.
        page_size = int(os.environ.get("STUB_PAGE_SIZE", "2"))
        start = keys.index(token) if token in keys else 0
        page, rest = keys[start:start + page_size], keys[start + page_size:]
        body = ["<?xml version='1.0' encoding='UTF-8'?>",
                "<ListBucketResult>", f"<KeyCount>{len(page)}</KeyCount>"]
        if rest:
            body.append(f"<IsTruncated>true</IsTruncated>"
                        f"<NextContinuationToken>{escape(rest[0])}</NextContinuationToken>")
        for key in page:
            body.append(f"<Contents><Key>{escape(key)}</Key></Contents>")
        body.append("</ListBucketResult>")
        payload = "".join(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/xml")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    os.makedirs(ROOT, exist_ok=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
