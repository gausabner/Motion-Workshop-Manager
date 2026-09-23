import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { ShareKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { announceTenant } from "@/lib/tenant-db";
import type { TenantTx } from "@/lib/tenant-db";

/**
 * Links a customer can open without an account.
 *
 * WhatsApp and a mail app's compose window carry text, not files, so sending a
 * document means sending a link to it — and that link is the only thing
 * standing between an invoice and anyone who sees the message. Hence: 32
 * random bytes, only the hash stored, an expiry, and revocation.
 *
 * Opening one is also the only honest delivery signal a hand-off channel has.
 * We cannot see whether someone pressed send in their own WhatsApp; we can see
 * whether the customer opened the invoice.
 */

export const SHARE_DAYS = 90;

function secret(): string {
    const value = process.env.SESSION_SECRET;
    if (!value || value.length < 16) throw new Error("SESSION_SECRET is not set (see .env.example)");
    return value;
}

export function hashShareToken(token: string): string {
    return createHash("sha256").update(`share.${token}.${secret()}`).digest("hex");
}

/** A document opens as a PDF; an inspection opens as a page the customer answers on. */
export function shareUrl(origin: string, token: string, kind: ShareKind = "DOCUMENT"): string {
    const path = kind === "INSPECTION" ? "approve" : kind === "PORTAL" ? "portal" : "share";
    return `${origin.replace(/\/$/, "")}/${path}/${token}`;
}

export async function mintShareLink(
    tx: TenantTx,
    input: { tenantId: string; kind: ShareKind; targetId: string; params?: Record<string, string>; createdById: string | null; days?: number },
): Promise<{ id: string; token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + (input.days ?? SHARE_DAYS) * 86_400_000);
    const link = await tx.shareLink.create({
        data: {
            tenantId: input.tenantId,
            tokenHash: hashShareToken(token),
            kind: input.kind,
            targetId: input.targetId,
            params: input.params ?? {},
            expiresAt,
            createdById: input.createdById,
        },
        select: { id: true },
    });
    return { id: link.id, token, expiresAt };
}

export type ResolvedShare =
    | { ok: true; id: string; tenantId: string; kind: ShareKind; targetId: string; params: Record<string, string> }
    | { ok: false; reason: "unknown" | "expired" | "revoked" };

/**
 * Look a token up. This is the one query in the app that runs without a
 * tenant, because the token *is* how we find the tenant — every read after it
 * goes through the tenant-scoped client.
 */
export async function resolveShareToken(token: string): Promise<ResolvedShare> {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return { ok: false, reason: "unknown" };
    const link = await prisma.shareLink.findUnique({
        where: { tokenHash: hashShareToken(token) },
        select: { id: true, tenantId: true, kind: true, targetId: true, params: true, expiresAt: true, revokedAt: true },
    });
    if (!link) return { ok: false, reason: "unknown" };
    if (link.revokedAt) return { ok: false, reason: "revoked" };
    if (link.expiresAt < new Date()) return { ok: false, reason: "expired" };
    return { ok: true, id: link.id, tenantId: link.tenantId, kind: link.kind, targetId: link.targetId, params: (link.params ?? {}) as Record<string, string> };
}

/**
 * Count the open. Not awaited by the caller's response path beyond this one write.
 *
 * A customer opening a WhatsApp link has no session and no membership, so there
 * is nothing to scope this by — but the link itself knows which workshop it
 * belongs to. Both writes run in one transaction that names the tenant, which
 * is also what lets them share a connection with the setting.
 */
export async function recordOpen(id: string): Promise<void> {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
        const owner = await tx.shareLink.findUnique({ where: { id }, select: { tenantId: true, firstOpenedAt: true } });
        if (!owner) return;
        await announceTenant(tx, owner.tenantId);
        await tx.shareLink.update({ where: { id }, data: { openCount: { increment: 1 }, lastOpenedAt: now } });
        if (!owner.firstOpenedAt) await tx.shareLink.update({ where: { id }, data: { firstOpenedAt: now } });
    });
}
