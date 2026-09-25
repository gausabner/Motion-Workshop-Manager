"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { bool, fromZod, str, type ActionState } from "@/lib/forms";
import { storeUpload, removeAttachment } from "@/lib/attachments/service";
import { accountingSettingsSchema, companySettingsSchema, handoffSettingsSchema, parseSettings, portalSettingsSchema, taxSettingsSchema } from "@/lib/settings/schema";

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

/** The customer portal: on or off, which sections, and how it looks (R5). */
export async function savePortalSettings(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");
    const section = (name: string) => bool(formData, `section.${name}`);
    const parsed = portalSettingsSchema.safeParse({
        enabled: bool(formData, "enabled"),
        sections: {
            account: section("account"), inspections: section("inspections"), jobs: section("jobs"), bookings: section("bookings"),
            vehicles: section("vehicles"), invoices: section("invoices"), quotes: section("quotes"),
        },
        accent: str(formData, "accent") ?? "#0d9488",
        welcome: str(formData, "welcome") ?? "",
        linkDays: Number(str(formData, "linkDays") ?? 180),
    });
    if (!parsed.success) return fromZod(parsed.error);
    await ctx.db.tenant.update({ where: { id: ctx.tenant.id }, data: { settings: { ...parseSettings(ctx.tenant.settings), portal: parsed.data } } });
    await ctx.db.auditEvent.create({ data: { tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "Tenant", entityId: ctx.tenant.id, action: "UPDATED", diff: { section: "portal", ...parsed.data } } });
    revalidatePath(`/${slug}/dashboard/settings/portal`);
    return { ok: true, message: parsed.data.enabled ? "Saved. Links you send from a customer's page now open their portal." : "Saved. The portal is off; links already sent say so." };
}

/**
 * The nightly hand-off, and the account codes it posts to (R3).
 *
 * The two are saved together on purpose. The codes are the thing that makes
 * the schedule safe to switch on — a journal posted to the wrong account every
 * night for a month is harder to undo than a month of not sending anything —
 * and splitting them across two screens is how somebody turns the first one on
 * without having done the second.
 */
export async function saveHandoffSettings(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "settings:manage");

    const handoff = handoffSettingsSchema.safeParse({
        enabled: bool(formData, "enabled"),
        shape: str(formData, "shape") ?? "motion",
        folder: str(formData, "folder") ?? "handoff/{tenant}/{yyyy}/{mm}",
        receiptFolder: str(formData, "receiptFolder") ?? "",
        keepYears: Number(str(formData, "keepYears") ?? 7),
    });
    if (!handoff.success) return fromZod(handoff.error);

    const accounting = accountingSettingsSchema.safeParse({
        salesAccount: str(formData, "salesAccount"),
        salesTaxType: str(formData, "salesTaxType"),
        debtors: str(formData, "debtors"),
        sales: str(formData, "sales"),
        tax: str(formData, "tax"),
        bank: str(formData, "bank"),
        creditors: str(formData, "creditors"),
        purchases: str(formData, "purchases"),
        inputTax: str(formData, "inputTax"),
    });
    if (!accounting.success) return fromZod(accounting.error);

    const settings = parseSettings(ctx.tenant.settings);
    await ctx.db.tenant.update({
        where: { id: ctx.tenant.id },
        data: { settings: { ...settings, handoff: handoff.data, accounting: accounting.data } },
    });
    await ctx.db.auditEvent.create({
        data: {
            tenantId: ctx.tenant.id, actorUserId: ctx.user.id, entityType: "Tenant", entityId: ctx.tenant.id,
            action: "UPDATED",
            // Worth recording that the schedule was switched on or off by name:
            // "when did we start sending the council our journals" is a question.
            diff: { section: "handoff", enabled: handoff.data.enabled, shape: handoff.data.shape },
        },
    });

    revalidatePath(`/${slug}/dashboard/settings/handoff`);
    revalidatePath(`/${slug}/dashboard/reports/handoff`);
    return { ok: true, message: "Saved" };
}
