/**
 * What every place that stores bytes talks to (R2).
 *
 * Call sites never learn where a file actually lives. A deployment picks a
 * driver with `STORAGE_DRIVER`, and because each stored object records the
 * driver that wrote it, a workshop that later moves to object storage keeps
 * reading everything it already had — the switch is config, not a migration.
 */

export type PutOptions = {
    contentType: string;
    /** For a download prompt when the bytes are served back. */
    fileName?: string;
};

export interface StorageDriver {
    /** Recorded on every object so a later driver switch can still find it. */
    readonly name: string;
    put(key: string, body: Buffer, options: PutOptions): Promise<void>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    /** True when the driver can serve the key at all; used by health checks, not by call sites. */
    exists(key: string): Promise<boolean>;
}

export class StorageError extends Error {
    constructor(message: string, readonly cause?: unknown) {
        super(message);
        this.name = "StorageError";
    }
}

export class ObjectNotFound extends StorageError {
    constructor(key: string) {
        super(`No stored object at ${key}`);
        this.name = "ObjectNotFound";
    }
}
