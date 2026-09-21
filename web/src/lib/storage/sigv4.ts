import { createHash, createHmac } from "node:crypto";

/**
 * AWS Signature Version 4, which is what S3, Cloudflare R2, MinIO, Backblaze
 * B2 and DigitalOcean Spaces all speak. Written out rather than pulled in as
 * an SDK: it is a page of well-specified hashing, and the alternative is a
 * ~20 MB dependency for four HTTP verbs.
 *
 * Pure and exported piece by piece so each step can be checked against the
 * worked example AWS publishes.
 */

export const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export type SigningInput = {
    method: string;
    /** Path only, already starting with "/" and not yet encoded. */
    path: string;
    query?: Record<string, string>;
    headers: Record<string, string>;
    /** Hex sha256 of the body, or UNSIGNED_PAYLOAD. */
    payloadHash: string;
    region: string;
    service: string;
    accessKeyId: string;
    secretAccessKey: string;
    at: Date;
};

export const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const hmac = (key: Buffer | string, value: string): Buffer => createHmac("sha256", key).update(value, "utf8").digest();

/** RFC 3986. AWS wants the unreserved set left alone and everything else percent-encoded. */
export function uriEncode(value: string, encodeSlash = true): string {
    let out = "";
    for (const char of value) {
        if (/[A-Za-z0-9\-._~]/.test(char)) out += char;
        else if (char === "/") out += encodeSlash ? "%2F" : "/";
        else out += [...Buffer.from(char, "utf8")].map((b) => `%${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
    }
    return out;
}

export const amzDate = (at: Date): string => at.toISOString().replace(/[-:]|\.\d{3}/g, "");
export const dateStamp = (at: Date): string => amzDate(at).slice(0, 8);

export function canonicalRequest(input: Pick<SigningInput, "method" | "path" | "query" | "headers" | "payloadHash">): { text: string; signedHeaders: string } {
    const query = Object.entries(input.query ?? {})
        .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");

    const headers = Object.entries(input.headers)
        .map(([k, v]) => [k.toLowerCase().trim(), v.trim().replace(/\s+/g, " ")] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

    const signedHeaders = headers.map(([k]) => k).join(";");
    const text = [
        input.method.toUpperCase(),
        uriEncode(input.path, false),
        query,
        headers.map(([k, v]) => `${k}:${v}`).join("\n") + "\n",
        signedHeaders,
        input.payloadHash,
    ].join("\n");
    return { text, signedHeaders };
}

export function stringToSign(at: Date, region: string, service: string, canonical: string): string {
    return ["AWS4-HMAC-SHA256", amzDate(at), `${dateStamp(at)}/${region}/${service}/aws4_request`, sha256(canonical)].join("\n");
}

export function signingKey(secretAccessKey: string, at: Date, region: string, service: string): Buffer {
    return hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp(at)), region), service), "aws4_request");
}

/** The full `Authorization` header value for a request. */
export function authorizationHeader(input: SigningInput): string {
    const { text, signedHeaders } = canonicalRequest(input);
    const signature = createHmac("sha256", signingKey(input.secretAccessKey, input.at, input.region, input.service))
        .update(stringToSign(input.at, input.region, input.service, text), "utf8")
        .digest("hex");
    const scope = `${dateStamp(input.at)}/${input.region}/${input.service}/aws4_request`;
    return `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}
