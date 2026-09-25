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

/** The customer portal (R5). Off until a workshop turns it on; each section can be left out. */
export const portalSettingsSchema = z.object({
    enabled: z.boolean().default(false),
    sections: z.object({
        account: z.boolean().default(true),
        inspections: z.boolean().default(true),
        jobs: z.boolean().default(true),
        bookings: z.boolean().default(true),
        vehicles: z.boolean().default(true),
        invoices: z.boolean().default(true),
        quotes: z.boolean().default(true),
    }).default({ account: true, inspections: true, jobs: true, bookings: true, vehicles: true, invoices: true, quotes: true }),
    /** The portal's accent, so it looks like the workshop rather than like us. */
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #0d9488").default("#0d9488"),
    welcome: z.string().trim().max(400).default(""),
    /** How long a portal link works. Long, because it is the customer's way back in. */
    linkDays: z.number().int().min(7).max(365).default(180),
});

export type PortalSettings = z.infer<typeof portalSettingsSchema>;
export type PortalSection = keyof PortalSettings["sections"];

export function portalSettings(value: unknown): PortalSettings {
    const raw = portalSettingsSchema.safeParse(parseSettings(value).portal ?? {});
    return raw.success ? raw.data : portalSettingsSchema.parse({});
}

/** Where the bookkeeper wants each total to land. Blank is fine: the plain export needs none of it. */
export const accountingSettingsSchema = z.object({
    salesAccount: z.string().trim().max(20).default("200"),
    salesTaxType: z.string().trim().max(40).default("Tax on Sales"),
    debtors: z.string().trim().max(20).default("610"),
    sales: z.string().trim().max(20).default("200"),
    tax: z.string().trim().max(20).default("820"),
    /// The other side of the entries the nightly hand-off posts, which the
    /// on-screen exports never needed: money received has to land somewhere,
    /// and so do supplier invoices and what was paid against them.
    bank: z.string().trim().max(20).default("090"),
    creditors: z.string().trim().max(20).default("800"),
    purchases: z.string().trim().max(20).default("300"),
    inputTax: z.string().trim().max(20).default("825"),
});

export type AccountingSettings = z.infer<typeof accountingSettingsSchema>;

export function accountingSettings(value: unknown): AccountingSettings {
    const raw = accountingSettingsSchema.safeParse(parseSettings(value).accounting ?? {});
    return raw.success ? raw.data : accountingSettingsSchema.parse({});
}


/**
 * The nightly hand-off (R3): where the file goes, in whose shape, and how long
 * the copies are kept.
 *
 * Off by default, and deliberately so. A workshop that has not set up an
 * integration should not have a job quietly writing files into a folder
 * nobody reads — and a schedule that runs before the accounts have been
 * agreed is how a council ends up importing a month of wrong codes.
 *
 * `folder` is a template rather than a path because the plan left a question
 * open that does not need answering: whether a council running four workshops
 * wants one drop folder or four. `{tenant}` in the template gives four,
 * leaving it out gives one, and the same build does both. `{yyyy}` and `{mm}`
 * keep a busy folder navigable, because a directory with nine hundred files in
 * it is one nobody will look inside.
 */
export const handoffSettingsSchema = z.object({
    enabled: z.boolean().default(false),
    /** Which accounting package is on the other end. */
    shape: z.enum(["motion", "quickbooks", "sage", "xero"]).default("motion"),
    /** Where the file is written, with {tenant}, {yyyy}, {mm} and {dd} replaced. */
    folder: z.string().trim().max(200).default("handoff/{tenant}/{yyyy}/{mm}"),
    /**
     * Where the receiving system writes its receipts, read on the next run.
     * Blank means the site has not agreed a receipt leg, and every run then
     * stays "delivered, not confirmed" rather than pretending otherwise.
     */
    receiptFolder: z.string().trim().max(200).default(""),
    /**
     * How long MOTION keeps its own copy of what it sent.
     *
     * Seven years is the working assumption for a Namibian council, and it is
     * a setting rather than a constant precisely because that has not been
     * confirmed with one. Nothing is deleted automatically yet; this is what
     * the screen reports against and what a future sweep will read.
     */
    keepYears: z.number().int().min(1).max(15).default(7),
});

export type HandoffSettings = z.infer<typeof handoffSettingsSchema>;

export function handoffSettings(value: unknown): HandoffSettings {
    const raw = handoffSettingsSchema.safeParse(parseSettings(value).handoff ?? {});
    return raw.success ? raw.data : handoffSettingsSchema.parse({});
}

export const tenantSettingsSchema = z.object({
    /** Printed under the invoice footer. Free text, because every bank lays it out differently. */
    bankDetails: z.string().trim().max(600).optional(),
    /** Attachment id of the letterhead logo. */
    logoAttachmentId: z.string().trim().max(60).optional(),
    diary: diarySettingsSchema.optional(),
    reminders: reminderSettingsSchema.optional(),
    portal: portalSettingsSchema.optional(),
    accounting: accountingSettingsSchema.optional(),
    handoff: handoffSettingsSchema.optional(),
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
