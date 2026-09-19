import { z } from "zod";
import type { DiarySettings } from "@/lib/diary/capacity";

/**
 * The typed half of `Tenant.settings` (PRD SET-09).
 *
 * Everything a workshop can change that does not deserve a column of its own
 * lives here, validated on the way in so a bad write cannot make a document
 * fail to render.
 */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Use a time like 07:30");

/** How the booking diary is laid out and when it counts as full (R4). */
export const diarySettingsSchema = z.object({
    opensAt: hhmm.default("07:30"),
    closesAt: hhmm.default("17:00"),
    slotMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
    workingDays: z.array(z.number().int().min(1).max(7)).min(1, "Open at least one day").default([1, 2, 3, 4, 5]),
    fullAtPercent: z.number().int().min(50).max(100).default(90),
    lanesPerPage: z.number().int().min(1).max(8).default(4),
    defaultBookingHours: z.number().min(0.25).max(12).default(1),
    /** Whether the public booking page is open at all. Off until a workshop turns it on. */
    onlineBooking: z.boolean().default(false),
    /** How many days ahead the earliest online booking is — 1 means nothing for today. */
    bookingLeadDays: z.number().int().min(0).max(14).default(1),
    bookingHorizonDays: z.number().int().min(7).max(90).default(30),
});

/** One reminder: on or off, and how many days before (or, for quotes, after) it goes out. */
const reminderRule = (days: number, max: number) => z.object({ enabled: z.boolean().default(true), days: z.number().int().min(0).max(max).default(days) }).default({ enabled: true, days });

/** When reminders fall due (R5). Everything is on by default: a reminder is only ever a suggestion until someone sends it. */
export const reminderSettingsSchema = z.object({
    service: reminderRule(14, 60),
    licence: reminderRule(21, 60),
    roadworthy: reminderRule(21, 60),
    booking: reminderRule(1, 7),
    quote: reminderRule(3, 30),
});

export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;

export function reminderSettings(value: unknown): ReminderSettings {
    const raw = reminderSettingsSchema.safeParse(parseSettings(value).reminders ?? {});
    return raw.success ? raw.data : reminderSettingsSchema.parse({});
}

export const tenantSettingsSchema = z.object({
    /** Printed under the invoice footer. Free text, because every bank lays it out differently. */
    bankDetails: z.string().trim().max(600).optional(),
    /** Attachment id of the letterhead logo. */
    logoAttachmentId: z.string().trim().max(60).optional(),
    diary: diarySettingsSchema.optional(),
    reminders: reminderSettingsSchema.optional(),
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

/** The diary settings in the minutes the capacity maths works in, defaults filled. */
export function diarySettings(value: unknown): DiarySettings {
    const raw = diarySettingsSchema.safeParse(parseSettings(value).diary ?? {});
    const d = raw.success ? raw.data : diarySettingsSchema.parse({});
    const toMinute = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const opensAt = toMinute(d.opensAt);
    const closesAt = Math.max(toMinute(d.closesAt), opensAt + d.slotMinutes);
    return {
        opensAt,
        closesAt,
        slotMinutes: d.slotMinutes,
        workingDays: [...new Set(d.workingDays)].sort(),
        fullAtPercent: d.fullAtPercent,
        lanesPerPage: d.lanesPerPage,
        defaultBookingMinutes: Math.round(d.defaultBookingHours * 60),
    };
}

export type OnlineBooking = { enabled: boolean; leadDays: number; horizonDays: number };

export function onlineBookingSettings(value: unknown): OnlineBooking {
    const raw = diarySettingsSchema.safeParse(parseSettings(value).diary ?? {});
    const d = raw.success ? raw.data : diarySettingsSchema.parse({});
    return { enabled: d.onlineBooking, leadDays: d.bookingLeadDays, horizonDays: d.bookingHorizonDays };
}
