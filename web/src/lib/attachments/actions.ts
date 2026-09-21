"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { removeAttachment, storeUpload, type UploadResult } from "@/lib/attachments/service";

/**
 * Attaching the EFT proof to the tender it belongs to, rather than to the
 * receipt, so a split payment with two transfers keeps each slip against the
 * transfer it proves.
 */
export async function uploadTenderProof(slug: string, tenderId: string, formData: FormData): Promise<UploadResult> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");

    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, message: "No file arrived. Try again." };

    const tender = await ctx.db.paymentTender.findUnique({
        where: { id: tenderId },
        select: { id: true, paymentId: true, proofAttachmentId: true, payment: { select: { state: true } } },
    });
    if (!tender) return { ok: false, message: "That tender is no longer there. Save the receipt and try again." };
    if (tender.payment.state === "VOID") return { ok: false, message: "This receipt was voided." };

    const result = await storeUpload(ctx, file, { ownerType: "PaymentTender", ownerId: tenderId });
    if (!result.ok) return result;

    // One slip per tender: replacing it drops the old one rather than stacking.
    const previous = tender.proofAttachmentId;
    await ctx.db.paymentTender.updateMany({ where: { id: tenderId }, data: { proofAttachmentId: result.attachmentId } });
    if (previous) await removeAttachment(ctx, previous);

    revalidatePath(`/${slug}/dashboard/payments/${tender.paymentId}`);
    return result;
}

export async function removeTenderProof(slug: string, tenderId: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");

    const tender = await ctx.db.paymentTender.findUnique({ where: { id: tenderId }, select: { paymentId: true, proofAttachmentId: true } });
    if (!tender?.proofAttachmentId) return;

    await ctx.db.paymentTender.updateMany({ where: { id: tenderId }, data: { proofAttachmentId: null } });
    await removeAttachment(ctx, tender.proofAttachmentId);
    revalidatePath(`/${slug}/dashboard/payments/${tender.paymentId}`);
}
