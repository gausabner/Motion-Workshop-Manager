import { z } from "zod";

/**
 * The typed half of `Tenant.settings` (PRD SET-09).
 *
 * Everything a workshop can change that does not deserve a column of its own
 * lives here, validated on the way in so a bad write cannot make a document
 * fail to render.
 */
export const tenantSettingsSchema = z.object({
    /** Printed under the invoice footer. Free text, because every bank lays it out differently. */
    bankDetails: z.string().trim().max(600).optional(),
    /** Attachment id of the letterhead logo. */
    logoAttachmentId: z.string().trim().max(60).optional(),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;

export function parseSettings(value: unknown): TenantSettings {
    const parsed = tenantSettingsSchema.safeParse(value ?? {});
    return parsed.success ? parsed.data : {};
}

const optionalText = (max: number) => z.string().trim().max(max).optional();

export const companySettingsSchema = z.object({
    name: z.string().trim().min(2, "The workshop needs a name").max(120),
    registrationNumber: optionalText(60),
    vatNumber: optionalText(60),
    address1: optionalText(120),
    address2: optionalText(120),
    suburb: optionalText(80),
    city: optionalText(80),
    region: optionalText(80),
    postcode: optionalText(20),
    country: z.string().trim().min(2).max(2).default("NA"),
    phone: optionalText(40),
    mobile: optionalText(40),
    whatsapp: optionalText(40),
    email: z.union([z.literal(""), z.email("That email does not look right")]).optional(),
    web: optionalText(120),
    timezone: z.string().trim().min(3).max(60),
    currency: z.string().trim().min(3).max(3),
    bankDetails: optionalText(600),
});

export const taxSettingsSchema = z.object({
    taxName: z.string().trim().min(2, "Give the tax a name, such as VAT").max(20),
    salesTaxRate: z.coerce.number().min(0, "Cannot be negative").max(100),
    purchaseTaxRate: z.coerce.number().min(0, "Cannot be negative").max(100),
    pricesIncludeTax: z.coerce.boolean(),
    defaultPaymentTermsDays: z.coerce.number().int().min(0).max(365),
});
