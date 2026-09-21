/**
 * Key shapes and upload rules. Pure, so the rules that decide what may be
 * stored can be tested without touching a disk or a bucket.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * What a workshop actually attaches: an EFT proof of payment, a photo of the
 * damage, a scanned authorisation. Anything that can execute is refused —
 * these files get handed back to browsers.
 */
export const ALLOWED_TYPES: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
};

export const ALLOWED_TYPE_LABEL = "PDF, JPEG, PNG, WebP or HEIC";

/** Keys are lowercase, slash-separated, and can never climb out of their prefix. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9._/-]{0,254}$/;

export function isSafeKey(key: string): boolean {
    if (!KEY_PATTERN.test(key)) return false;
    if (key.includes("//") || key.endsWith("/")) return false;
    return !key.split("/").some((segment) => segment === "." || segment === ".." || segment === "");
}

export function assertSafeKey(key: string): void {
    if (!isSafeKey(key)) throw new Error(`Unsafe storage key: ${JSON.stringify(key)}`);
}

/** The extension to store under, taken from the declared type rather than the name the browser sent. */
export function extensionFor(contentType: string): string | null {
    return ALLOWED_TYPES[contentType.toLowerCase().split(";")[0].trim()] ?? null;
}

/**
 * Keep the original name for the download prompt, but strip anything that
 * could be read as a path or a control character on the way out.
 */
export function safeFileName(name: string, fallback = "attachment"): string {
    const base = name.split(/[\\/]/).pop() ?? "";
    const cleaned = base.replace(/[\u0000-\u001f"\\]/g, "").trim().slice(0, 120);
    return cleaned || fallback;
}

/** `t/<tenant>/<owner type>/<owner>/<id>.<ext>` — grouped so one workshop's files are one subtree. */
export function buildKey(parts: { tenantId: string; ownerType: string; ownerId: string; id: string; extension: string }): string {
    const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const key = `t/${slug(parts.tenantId)}/${slug(parts.ownerType)}/${slug(parts.ownerId)}/${slug(parts.id)}.${parts.extension}`;
    assertSafeKey(key);
    return key;
}

/** Why this upload cannot be accepted, or null when it can. */
export function uploadError(file: { size: number; type: string; name: string }): string | null {
    if (!file.size) return "That file is empty.";
    if (file.size > MAX_UPLOAD_BYTES) return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`;
    if (!extensionFor(file.type)) return `${safeFileName(file.name)} is not a kind of file we store. Use ${ALLOWED_TYPE_LABEL}.`;
    return null;
}
