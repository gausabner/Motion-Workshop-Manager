import "server-only";
import { createHash } from "node:crypto";
import type { TenantContext } from "@/lib/auth/session";
import type { TenantDb } from "@/lib/tenant-db";
import { buildKey, driverNamed, extensionFor, safeFileName, storage, uploadError } from "@/lib/storage";

/**
 * Storing a file and remembering where it went (R2).
 *
 * Nothing here knows whether the bytes land on a disk or in a bucket. The
 * driver that wrote each object is recorded on the row, so reads keep working
 * across a driver switch and a deployment can run both at once while it moves.
 */

export type UploadResult = { ok: true; attachmentId: string } | { ok: false; message: string };

export async function storeUpload(
    ctx: TenantContext,
    file: File,
    owner: { ownerType: string; ownerId: string },
): Promise<UploadResult> {
    const problem = uploadError({ size: file.size, type: file.type, name: file.name });
    if (problem) return { ok: false, message: problem };

    const extension = extensionFor(file.type);
    if (!extension) return { ok: false, message: "That kind of file cannot be stored." };

    const body = Buffer.from(await file.arrayBuffer());
    // Re-check after reading: `File.size` is what the browser claimed.
    if (body.byteLength !== file.size) return { ok: false, message: "That upload did not arrive intact. Try again." };

    const driver = storage();
    const { db, tenant, membership, user } = ctx;

    // The row is created first so the key carries an id the database already
    // owns — an orphaned row beats a written file nothing points at.
    const attachment = await db.attachment.create({
        data: {
            tenantId: tenant.id,
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            driver: driver.name,
            storageKey: "",
            fileName: safeFileName(file.name, `proof.${extension}`),
            mimeType: file.type.toLowerCase().split(";")[0].trim(),
            size: body.byteLength,
            checksum: createHash("sha256").update(body).digest("hex"),
            uploadedById: membership.id,
        },
        select: { id: true, mimeType: true },
    });

    const key = buildKey({ tenantId: tenant.id, ownerType: owner.ownerType, ownerId: owner.ownerId, id: attachment.id, extension });
    try {
        await driver.put(key, body, { contentType: attachment.mimeType, fileName: file.name });
    } catch (cause) {
        await db.attachment.delete({ where: { id: attachment.id } }).catch(() => {});
        throw cause;
    }

    await db.attachment.update({ where: { id: attachment.id }, data: { storageKey: key } });
    await db.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Attachment", entityId: attachment.id, action: "CREATED", diff: { ...owner, driver: driver.name } },
    });
    return { ok: true, attachmentId: attachment.id };
}

/** The bytes, read through whichever driver wrote them. */
export async function readAttachment(db: TenantDb, id: string) {
    const attachment = await db.attachment.findUnique({
        where: { id },
        select: { id: true, driver: true, storageKey: true, fileName: true, mimeType: true, size: true },
    });
    if (!attachment || !attachment.storageKey) return null;
    const body = await driverNamed(attachment.driver).get(attachment.storageKey);
    return { ...attachment, body };
}

export async function listAttachments(db: TenantDb, owner: { ownerType: string; ownerIds: string[] }) {
    if (!owner.ownerIds.length) return [];
    return db.attachment.findMany({
        where: { ownerType: owner.ownerType, ownerId: { in: owner.ownerIds } },
        orderBy: { createdAt: "asc" },
        select: { id: true, ownerId: true, fileName: true, mimeType: true, size: true, createdAt: true },
    });
}

/** Remove the row first, then the bytes: a file left behind is cheaper than a row pointing at nothing. */
export async function removeAttachment(ctx: TenantContext, id: string): Promise<void> {
    const { db, tenant, user } = ctx;
    const attachment = await db.attachment.findUnique({ where: { id }, select: { id: true, driver: true, storageKey: true } });
    if (!attachment) return;
    await db.attachment.delete({ where: { id } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Attachment", entityId: id, action: "DELETED" } });
    if (attachment.storageKey) await driverNamed(attachment.driver).delete(attachment.storageKey).catch(() => {});
}
