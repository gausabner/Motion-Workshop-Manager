import { z } from "zod";
import { optionalNumber, optionalInt } from "@/lib/forms";

export const CONTACT_METHODS = ["WHATSAPP", "SMS", "EMAIL", "OPT_OUT"] as const;
export const PRICE_TYPES = ["RETAIL", "PRICE2", "PRICE3", "PRICE4"] as const;

const opt = z.string().trim().max(255).optional();

export const customerSchema = z.object({
    firstName: z.string().trim().min(1, "Required").max(100),
    lastName: z.string().trim().min(1, "Required").max(100),
    isBusiness: z.boolean().default(false),
    businessNumber: opt,
    vatNumber: opt,
    mobile: opt,
    phone: opt,
    email: z.email("Enter a valid email").optional().or(z.literal("").transform(() => undefined)),
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
});

export type CustomerInput = z.infer<typeof customerSchema>;
