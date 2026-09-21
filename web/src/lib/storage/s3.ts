import "server-only";
import { assertSafeKey } from "@/lib/storage/keys";
import { authorizationHeader, amzDate, sha256, uriEncode } from "@/lib/storage/sigv4";
import { ObjectNotFound, StorageError, type PutOptions, type StorageDriver } from "@/lib/storage/types";

export type S3Config = {
    endpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    /** MinIO and most self-hosted gateways need the bucket in the path. */
    forcePathStyle: boolean;
};

/**
 * Any S3-compatible bucket: AWS S3, Cloudflare R2, MinIO, Backblaze B2,
 * DigitalOcean Spaces. Four verbs over `fetch`, signed with SigV4.
 *
 * This is the other half of "one codebase, either deployment". A workshop that
 * outgrows a single machine changes `STORAGE_DRIVER` and its credentials;
 * nothing that stores or reads a file knows the difference, and files written
 * under the old driver keep resolving because each one records its own.
 */
export class S3Driver implements StorageDriver {
    readonly name = "s3";

    constructor(private readonly config: S3Config) {}

    private target(key: string): { url: string; host: string; path: string } {
        assertSafeKey(key);
        const endpoint = new URL(this.config.endpoint);
        const encoded = uriEncode(`/${key}`, false);
        if (this.config.forcePathStyle) {
            const path = `${endpoint.pathname.replace(/\/$/, "")}/${this.config.bucket}${encoded}`;
            return { url: `${endpoint.origin}${path}`, host: endpoint.host, path };
        }
        const host = `${this.config.bucket}.${endpoint.host}`;
        return { url: `${endpoint.protocol}//${host}${encoded}`, host, path: encoded };
    }

    private async send(method: string, key: string, body?: Buffer, extraHeaders: Record<string, string> = {}): Promise<Response> {
        const { url, host, path } = this.target(key);
        const at = new Date();
        const payloadHash = sha256(body ?? "");
        const headers: Record<string, string> = {
            Host: host,
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate(at),
            ...extraHeaders,
        };
        headers.Authorization = authorizationHeader({
            method, path, headers, payloadHash,
            region: this.config.region, service: "s3",
            accessKeyId: this.config.accessKeyId, secretAccessKey: this.config.secretAccessKey, at,
        });
        // `Host` is signed but set by fetch itself, so it must not go on the wire twice.
        const wire = { ...headers };
        delete wire.Host;
        try {
            return await fetch(url, { method, headers: wire, body: body as BodyInit | undefined, cache: "no-store" });
        } catch (cause) {
            throw new StorageError(`Could not reach the bucket for ${key}`, cause);
        }
    }

    private static async fail(response: Response, key: string, verb: string): Promise<never> {
        if (response.status === 404) throw new ObjectNotFound(key);
        throw new StorageError(`${verb} ${key} failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
    }

    async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
        const response = await this.send("PUT", key, body, {
            "Content-Type": options.contentType,
            "Content-Length": String(body.byteLength),
        });
        if (!response.ok) await S3Driver.fail(response, key, "Storing");
    }

    async get(key: string): Promise<Buffer> {
        const response = await this.send("GET", key);
        if (!response.ok) await S3Driver.fail(response, key, "Reading");
        return Buffer.from(await response.arrayBuffer());
    }

    async delete(key: string): Promise<void> {
        const response = await this.send("DELETE", key);
        // A bucket reports a delete of something absent as a success, which is what we want anyway.
        if (!response.ok && response.status !== 404) await S3Driver.fail(response, key, "Deleting");
    }

    async exists(key: string): Promise<boolean> {
        const response = await this.send("HEAD", key);
        return response.ok;
    }
}
