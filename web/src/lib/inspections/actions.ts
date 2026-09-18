"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { removeAttachment, storeUpload } from "@/lib/attachments/service";
import { ensureDefaultInspectionTemplate } from "@/lib/inspections/defaults";
import { addApprovedToJob, createInspection, decideAndBook, finalise, reopen, requestApproval, saveItems, type ItemPatch } from "@/lib/inspections/service";

type Result = { ok: true; message?: string } | { ok: false; message: string };

const path = (slug: string, id: string) => `/${slug}/dashboard/inspections/${id}`;

async function run(slug: string, id: string, work: (ctx: Awaited<ReturnType<typeof requireTenant>>) => Promise<string | void>): Promise<Result> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    try {
        const message = await work(ctx);
        const inspection = await ctx.db.inspection.findUnique({ where: { id }, select: { documentId: true } });
        revalidatePath(path(slug, id));
        if (inspection?.documentId) revalidatePath(`/${slug}/dashboard/documents/${inspection.documentId}`);
        revalidatePath(`/${slug}/dashboard/jobs`);
        return { ok: true, message: message || undefined };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That did not work" };
    }
}

export async function startInspection(slug: string, documentId: string, templateId?: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    await ensureDefaultInspectionTemplate(ctx.db, ctx.tenant.id);
    const template = templateId
        ? await ctx.db.inspectionTemplate.findUnique({ where: { id: templateId }, select: { id: true } })
        : await ctx.db.inspectionTemplate.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true } });
    if (!template) throw new Error("There is no inspection template to start from");
    const created = await ctx.db.$transaction((tx) => createInspection(tx, ctx.tenant, ctx.membership.id, { documentId, templateId: template.id }));
    revalidatePath(`/${slug}/dashboard/documents/${documentId}`);
    redirect(path(slug, created.id));
}

export async function saveInspectionItems(slug: string, id: string, patches: ItemPatch[]): Promise<Result> {
    return run(slug, id, (ctx) => ctx.db.$transaction((tx) => saveItems(tx, id, patches)));
}

export async function sendForApproval(slug: string, id: string): Promise<Result> {
    return run(slug, id, (ctx) => ctx.db.$transaction((tx) => requestApproval(tx, id)));
}

export async function reopenInspection(slug: string, id: string): Promise<Result> {
    return run(slug, id, (ctx) => ctx.db.$transaction((tx) => reopen(tx, id)));
}

/** A decision taken over the phone at the counter. The record says who took it. */
export async function decideForCustomer(slug: string, id: string, itemId: string, answer: "approve" | "decline" | "clear"): Promise<Result> {
    return run(slug, id, async (ctx) => {
        const r = await ctx.db.$transaction((tx) => decideAndBook(tx, id, itemId, answer, `${ctx.user.firstName} ${ctx.user.lastName} (by phone)`));
        return r.added ? "Added to the job card" : undefined;
    });
}

export async function addApproved(slug: string, id: string): Promise<Result> {
    return run(slug, id, async (ctx) => {
        const { added } = await ctx.db.$transaction((tx) => addApprovedToJob(tx, id));
        return added ? `${added} finding${added === 1 ? "" : "s"} added to the job card` : "Nothing new to add";
    });
}

export async function finaliseInspection(slug: string, id: string): Promise<Result> {
    return run(slug, id, (ctx) => ctx.db.$transaction((tx) => finalise(tx, id)));
}

/** A photo of the finding, from the phone's camera, through the same storage as every other file. */
export async function uploadFindingPhoto(slug: string, inspectionId: string, itemId: string, formData: FormData): Promise<{ ok: true; id: string; fileName: string } | { ok: false; message: string }> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const item = await ctx.db.inspectionItem.findFirst({ where: { id: itemId, inspectionId }, select: { id: true } });
    if (!item) return { ok: false, message: "That finding is not on this inspection" };
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false, message: "No photo arrived. Try again." };
    if (!file.type.startsWith("image/")) return { ok: false, message: "That is not a photo." };
    const result = await storeUpload(ctx, file, { ownerType: "InspectionItem", ownerId: itemId });
    if (!result.ok) return result;
    revalidatePath(path(slug, inspectionId));
    return { ok: true, id: result.attachmentId, fileName: file.name };
}

export async function removeFindingPhoto(slug: string, inspectionId: string, attachmentId: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "documents:write");
    const photo = await ctx.db.attachment.findUnique({ where: { id: attachmentId }, select: { ownerType: true, ownerId: true } });
    if (photo?.ownerType !== "InspectionItem") return;
    const item = await ctx.db.inspectionItem.findFirst({ where: { id: photo.ownerId, inspectionId }, select: { id: true } });
    if (!item) return;
    await removeAttachment(ctx, attachmentId);
    revalidatePath(path(slug, inspectionId));
}
