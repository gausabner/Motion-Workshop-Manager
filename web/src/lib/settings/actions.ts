"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { bool, fromZod, str, type ActionState } from "@/lib/forms";
import { storeUpload, removeAttachment } from "@/lib/attachments/service";
import { companySettingsSchema, parseSettings, taxSettingsSchema } from "@/lib/settings/schema";

/**
 * Company profile and tax defaults (PRD SET-01/02).
 *
 * Note what changing the tax rate does *not* do: it does not touch a single
 * existing document. Every document carries the rate it was raised at, so this
 * only decides what the next one is stamped with.
 */
export async function saveCompanySettings(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");

    const parsed = companySettingsSchema.safeParse({
        name: str(formData, "name"),
        registrationNumber: str(formData, "registrationNumber"),
        vatNumber: str(formData, "vatNumber"),
        address1: str(formData, "address1"),
        address2: str(formData, "address2"),
        suburb: str(formData, "suburb"),
        city: str(formData, "city"),
        region: str(formData, "region"),
        postcode: str(formData, "postcode"),
        country: str(formData, "country") ?? "NA",
        phone: str(formData, "phone"),
        mobile: str(formData, "mobile"),
        whatsapp: str(formData, "whatsapp"),
        email: str(formData, "email") ?? "",
        web: str(formData, "web"),
        timezone: str(formData, "timezone") ?? ctx.tenant.timezone,
        currency: str(formData, "currency") ?? ctx.tenant.currency,
        bankDetails: str(formData, "bankDetails"),
    });
    if (!parsed.success) return fromZod(parsed.error);
    const { bankDetails, ...company } = parsed.data;

    const settings = parseSettings(ctx.tenant.settings);
    await ctx.db.tenant.update({
        where: { id: ctx.tenant.id },
        data: {
            ...company,
            email: company.email || null,
            settings: { ...settings, bankDetails: bankDetails || undefined },
        },
    });
    await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "Tenant", entityId: ctx.tenant.id, action: "UPDATED", diff: { section: "company" } } });

    revalidatePath(`/${slug}/dashboard/settings/company`);
    return { ok: true, message: "Saved" };
}

export async function saveTaxSettings(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");

    const parsed = taxSettingsSchema.safeParse({
        taxName: str(formData, "taxName"),
        salesTaxRate: str(formData, "salesTaxRate") ?? 0,
        purchaseTaxRate: str(formData, "purchaseTaxRate") ?? 0,
        pricesIncludeTax: bool(formData, "pricesIncludeTax"),
        defaultPaymentTermsDays: str(formData, "defaultPaymentTermsDays") ?? 0,
    });
    if (!parsed.success) return fromZod(parsed.error);

    await ctx.db.tenant.update({ where: { id: ctx.tenant.id }, data: parsed.data });
    await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "Tenant", entityId: ctx.tenant.id, action: "UPDATED", diff: { section: "tax", ...parsed.data } } });

    revalidatePath(`/${slug}/dashboard/settings/tax`);
    return { ok: true, message: "Saved. Documents already raised keep the rate they were raised at." };
}

/** The letterhead logo, stored through the same layer as every other file. */
export async function uploadLogo(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");

    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, message: "Choose an image first." };
    if (!file.type.startsWith("image/")) return { ok: false, message: "A logo has to be an image — PNG or JPEG works best." };

    const result = await storeUpload(ctx, file, { ownerType: "Tenant", ownerId: ctx.tenant.id });
    if (!result.ok) return { ok: false, message: result.message };

    const settings = parseSettings(ctx.tenant.settings);
    await ctx.db.tenant.update({ where: { id: ctx.tenant.id }, data: { settings: { ...settings, logoAttachmentId: result.attachmentId } } });
    if (settings.logoAttachmentId) await removeAttachment(ctx, settings.logoAttachmentId);

    revalidatePath(`/${slug}/dashboard/settings/company`);
    return { ok: true, message: "Logo updated" };
}

export async function removeLogo(slug: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");
    const settings = parseSettings(ctx.tenant.settings);
    if (!settings.logoAttachmentId) return;
    await ctx.db.tenant.update({ where: { id: ctx.tenant.id }, data: { settings: { ...settings, logoAttachmentId: undefined } } });
    await removeAttachment(ctx, settings.logoAttachmentId);
    revalidatePath(`/${slug}/dashboard/settings/company`);
}
