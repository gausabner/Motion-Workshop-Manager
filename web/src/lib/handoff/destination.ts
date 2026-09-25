/**
 * Where a hand-off file lands.
 *
 * The plan left a question open — one drop folder per workshop, or one per
 * council where a council runs several — and building it as a template means
 * the question does not have to be answered before the code is written. A
 * template with `{tenant}` in it gives a folder each; one without gives a
 * shared folder with the workshop's name in every file name, which is what a
 * council consolidating four sites actually wants. Both come out of the same
 * build, and switching is a settings change rather than a deployment.
 *
 * Deliberately just a key, handed to the storage driver the deployment already
 * configured. A drop folder on a file server is the `local` driver pointed at
 * a mount; a bucket the ERP polls is `s3`. Neither needs anything here to know
 * which, which is the same reason attachments do not.
 *
 * SFTP is the obvious fourth driver and is not written: it means a dependency
 * and a credential store, and every site asked for so far wants a folder.
 * When one asks, it is a `StorageDriver` beside the other two, not a change
 * here.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Strip anything that could climb out of the folder or upset a file server. */
export function safeSegment(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60);
}

export type DestinationInput = {
    /** The template from settings, e.g. `handoff/{tenant}/{yyyy}/{mm}`. */
    folder: string;
    tenantSlug: string;
    /** The day the file is for, not the day it was written. */
    day: Date;
};

/**
 * The folder, with the placeholders filled in.
 *
 * Every substituted value is cleaned first, so a workshop that names itself
 * with a slash cannot write outside the drop folder. `..` cannot survive
 * `safeSegment`, and neither can a leading dot.
 */
export function resolveFolder({ folder, tenantSlug, day }: DestinationInput): string {
    const replacements: Record<string, string> = {
        "{tenant}": safeSegment(tenantSlug),
        "{yyyy}": String(day.getUTCFullYear()),
        "{mm}": pad(day.getUTCMonth() + 1),
        "{dd}": pad(day.getUTCDate()),
    };
    const filled = Object.entries(replacements).reduce((out, [token, value]) => out.split(token).join(value), folder);
    return filled
        .split("/")
        .map((segment) => (segment.includes("{") ? safeSegment(segment) : segment.trim()))
        .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
        .join("/");
}

/**
 * What the file is called.
 *
 * The workshop is in the name even when it is also in the path, because these
 * files get copied out of the folder — attached to an email, dropped on a
 * desktop — and a file called `journal-2026-09-24.csv` from one of four
 * workshops is a file nobody can place.
 */
export function handoffFileName(tenantSlug: string, kind: "journal" | "bundle", shape: string, day: Date, extension: "csv" | "zip"): string {
    const iso = day.toISOString().slice(0, 10);
    const shapePart = kind === "journal" && shape !== "motion" ? `-${safeSegment(shape)}` : "";
    return `${safeSegment(tenantSlug)}-${kind}${shapePart}-${iso}.${extension}`;
}

export const destinationKey = (folder: string, fileName: string): string => (folder ? `${folder}/${fileName}` : fileName);
