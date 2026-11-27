import { z } from "zod";
import { optionalNumber, optionalInt } from "@/lib/forms";

export const CONTACT_METHODS = ["WHATSAPP", "SMS", "EMAIL", "OPT_OUT"] as const;
export const PRICE_TYPES = ["RETAIL", "PRICE2", "PRICE3", "PRICE4"] as const;

const opt = z.string().trim().max(255).optional();

/**
 * A person has a first and a last name. A business or fleet account has one
 * name — a company, or a department such as "Water and sanitation" — kept in
 * `lastName`, so lists sort by it, with `firstName` left empty. Asking an
 * organisation to split "Water and sanitation" into a first and last name is
 * what the form used to do.
 */
export const customerSchema = z.object({
    firstName: z.string().trim().max(100).default(""),
    lastName: z.string().trim().max(100).default(""),
    isBusiness: z.boolean().default(false),
    businessNumber: opt,
    vatNumber: opt,
    mobile: opt,
    phone: opt,
    email: z.email("Enter a valid email address.").optional().or(z.literal("").transform(() => undefined)),
    fax: opt,
    web: opt,
    preferredContact: z.enum(CONTACT_METHODS).default("WHATSAPP"),
    streetAddress1: opt,
    streetAddress2: opt,
    streetSuburb: opt,
    streetCity: opt,
    streetRegion: opt,
    streetCountry: opt,
    streetPostcode: opt,
    postalAddress1: opt,
    postalAddress2: opt,
    postalSuburb: opt,
    postalCity: opt,
    postalRegion: opt,
    postalCountry: opt,
    postalPostcode: opt,
    hourlyRate: optionalNumber,
    discountPercent: optionalNumber.default(0),
    markupPercent: optionalNumber.default(0),
    priceType: z.enum(PRICE_TYPES).default("RETAIL"),
    paymentTermsDays: optionalInt,
    creditLimit: optionalNumber,
    vatExempt: z.boolean().default(false),
    customerSourceId: opt,
    note: z.string().trim().max(4000).optional(),
}).superRefine((value, ctx) => {
    if (!value.isBusiness && !value.firstName) ctx.addIssue({ code: "custom", path: ["firstName"], message: "Enter a first name." });
    if (!value.lastName) ctx.addIssue({ code: "custom", path: ["lastName"], message: value.isBusiness ? "Enter the business or department name." : "Enter a last name." });
}).transform((value) => (value.isBusiness ? { ...value, firstName: "" } : value));

export type CustomerInput = z.infer<typeof customerSchema>;
