import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { assertSafeKey } from "@/lib/storage/keys";
import { ObjectNotFound, StorageError, type StorageDriver } from "@/lib/storage/types";

/**
 * Files on the machine the app runs on. The default, and all a single-workshop
 * deployment ever needs.
 *
 * Two safeguards worth naming: every key is checked against the key rules
 * before it becomes a path, and the resolved path is checked to still be
 * inside the root afterwards. Either alone would probably do; a traversal out
 * of the root would hand one workshop another's files, so it gets both.
 */
export class LocalDriver implements StorageDriver {
    readonly name = "local";
    private readonly root: string;

    constructor(root: string) {
        this.root = resolve(root);
    }

    private pathFor(key: string): string {
        assertSafeKey(key);
        const full = resolve(join(this.root, key));
        if (full !== this.root && !full.startsWith(this.root + sep)) throw new StorageError(`Key escapes the storage root: ${key}`);
        return full;
    }

    // Content type is not stored: a local file is served back from what the row records.
    async put(key: string, body: Buffer): Promise<void> {
        const path = this.pathFor(key);
        await mkdir(dirname(path), { recursive: true });
        // Write beside the target and rename, so a crash mid-write never leaves
        // a half-file that reads as a valid attachment.
        const staging = `${path}.${createHash("sha1").update(key).digest("hex").slice(0, 8)}.part`;
        await writeFile(staging, body, { flag: "w" });
        try {
            await writeFile(path, await readFile(staging));
        } finally {
            await rm(staging, { force: true });
        }
    }

    async get(key: string): Promise<Buffer> {
        // Resolved outside the try: a rejected key is a refusal, and must not be
        // reported as though the file merely could not be read.
        const path = this.pathFor(key);
        try {
            return await readFile(path);
        } catch (cause) {
            if ((cause as NodeJS.ErrnoException)?.code === "ENOENT") throw new ObjectNotFound(key);
            throw new StorageError(`Could not read ${key}`, cause);
        }
    }

    async delete(key: string): Promise<void> {
        await rm(this.pathFor(key), { force: true });
    }

    async exists(key: string): Promise<boolean> {
        try {
            const info = await stat(this.pathFor(key));
            return info.isFile();
        } catch {
            return false;
        }
    }
}
