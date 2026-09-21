import "server-only";
import { LocalDriver } from "@/lib/storage/local";
import { S3Driver, type S3Config } from "@/lib/storage/s3";
import { StorageError, type StorageDriver } from "@/lib/storage/types";

export { ObjectNotFound, StorageError, type PutOptions, type StorageDriver } from "@/lib/storage/types";
export {
    ALLOWED_TYPES, ALLOWED_TYPE_LABEL, MAX_UPLOAD_BYTES,
    assertSafeKey, buildKey, extensionFor, isSafeKey, safeFileName, uploadError,
} from "@/lib/storage/keys";

/**
 * Which driver this deployment writes with, and how to reach any driver that
 * has ever written here.
 *
 * `STORAGE_DRIVER` decides where new files go — `local` (the default) or `s3`.
 * `driverNamed()` resolves whatever a stored object says wrote it, so a
 * workshop that switches keeps reading everything from before the switch, and
 * a run of both at once is a supported state rather than an accident.
 */

const drivers = new Map<string, StorageDriver>();

function env(name: string, fallback?: string): string {
    const value = process.env[name]?.trim();
    if (value) return value;
    if (fallback !== undefined) return fallback;
    throw new StorageError(`${name} is not set (see .env.example)`);
}

function build(name: string): StorageDriver {
    switch (name) {
        case "local":
            return new LocalDriver(env("STORAGE_LOCAL_ROOT", ".data/attachments"));
        case "s3": {
            const config: S3Config = {
                endpoint: env("STORAGE_S3_ENDPOINT"),
                bucket: env("STORAGE_S3_BUCKET"),
                region: env("STORAGE_S3_REGION", "auto"),
                accessKeyId: env("STORAGE_S3_ACCESS_KEY_ID"),
                secretAccessKey: env("STORAGE_S3_SECRET_ACCESS_KEY"),
                forcePathStyle: env("STORAGE_S3_FORCE_PATH_STYLE", "false") === "true",
            };
            return new S3Driver(config);
        }
        default:
            throw new StorageError(`Unknown STORAGE_DRIVER ${JSON.stringify(name)}. Use "local" or "s3".`);
    }
}

/**
 * Drivers are built once and kept, so a test that changes the environment has
 * to say so rather than silently getting a stale one.
 */
export function resetDriversForTest(): void {
    drivers.clear();
}

/** A named driver, built once. Used to read objects written before a driver switch. */
export function driverNamed(name: string): StorageDriver {
    const existing = drivers.get(name);
    if (existing) return existing;
    const driver = build(name);
    drivers.set(name, driver);
    return driver;
}

/** The driver new files are written with. */
export function storage(): StorageDriver {
    return driverNamed(process.env.STORAGE_DRIVER?.trim() || "local");
}
