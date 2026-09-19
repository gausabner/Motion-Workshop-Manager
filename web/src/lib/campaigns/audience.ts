import { z } from "zod";
import type { ContactMethod, MessageChannel } from "@prisma/client";
import { toInternational } from "@/lib/messaging/phone";

/**
 * Who a bulk message goes to, and how it reaches them.
 *
 * Two rules decide everyone: a customer who opted out is never in an audience,
 * and a customer with no way to receive the chosen channel is listed as left
 * out with the reason, never silently dropped. The benchmark's segmentation
 * (postcode, vehicle, source, last in) is here too.
 */

const optionalDay = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-20")]).optional();

export const filtersSchema = z.object({
    /** Customer sources to include; empty means every source. */
    sourceIds: z.array(z.string().min(1).max(40)).max(30).default([]),
    /** Matches suburb, city or postcode, street or postal. */
    area: z.string().trim().max(60).default(""),
    /** Matches a vehicle's make, model or plate. */
    vehicle: z.string().trim().max(60).default(""),
    /** Last invoice or job before this day — the lapsed customers. */
    lastInBefore: optionalDay,
    /** First seen on or after this day — the new ones. */
    customerSince: optionalDay,
    owing: z.enum(["any", "owing", "overdue"]).default("any"),
    serviceDueWithinDays: z.number().int().min(0).max(365).default(0),
    licenceWithinDays: z.number().int().min(0).max(365).default(0),
});

export type AudienceFilters = z.infer<typeof filtersSchema>;

export const EMPTY_FILTERS: AudienceFilters = filtersSchema.parse({});

/** Whether anything narrows the audience — an unfiltered send goes to every customer, which deserves saying out loud. */
export function isEveryone(f: AudienceFilters): boolean {
    return f.sourceIds.length === 0 && !f.area && !f.vehicle && !f.lastInBefore && !f.customerSince
        && f.owing === "any" && f.serviceDueWithinDays === 0 && f.licenceWithinDays === 0;
}

export function describeAudience(f: AudienceFilters, sourceNames: Map<string, string>): string[] {
    const lines: string[] = [];
    if (f.sourceIds.length) lines.push(`came to you through ${f.sourceIds.map((id) => sourceNames.get(id) ?? "a source since removed").join(" or ")}`);
    if (f.area) lines.push(`in ${f.area}`);
    if (f.vehicle) lines.push(`driving a ${f.vehicle}`);
    if (f.lastInBefore) lines.push(`not in since ${f.lastInBefore}`);
    if (f.customerSince) lines.push(`a customer since ${f.customerSince}`);
    if (f.owing === "owing") lines.push("with money owing");
    if (f.owing === "overdue") lines.push("more than 30 days overdue");
    if (f.serviceDueWithinDays) lines.push(`with a service due within ${f.serviceDueWithinDays} days`);
    if (f.licenceWithinDays) lines.push(`with a licence disc expiring within ${f.licenceWithinDays} days`);
    return lines;
}

export type Contactable = { mobile: string | null; email: string | null; preferredContact: ContactMethod };
export type Reach =
    | { ok: true; channel: MessageChannel; recipient: string }
    | { ok: false; reason: string };

/**
 * The channel one customer is reached on. With "use preferred" the customer's
 * own choice wins and the other channel is the fallback; otherwise the chosen
 * channel is used, and anyone it cannot reach is left out with a reason.
 */
export function reachFor(customer: Contactable, channel: MessageChannel, usePreferred: boolean, country: string): Reach {
    if (customer.preferredContact === "OPT_OUT") return { ok: false, reason: "Opted out of messages" };
    const whatsapp = toInternational(customer.mobile, country);
    const email = customer.email?.trim() || null;
    const on = (c: MessageChannel): Reach => {
        if (c === "EMAIL") return email ? { ok: true, channel: "EMAIL", recipient: email } : { ok: false, reason: "No email address" };
        return whatsapp ? { ok: true, channel: "WHATSAPP", recipient: whatsapp } : { ok: false, reason: customer.mobile ? "Mobile number WhatsApp cannot reach" : "No mobile number" };
    };
    if (!usePreferred) return on(channel);
    const preferred: MessageChannel = customer.preferredContact === "EMAIL" ? "EMAIL" : "WHATSAPP";
    const first = on(preferred);
    if (first.ok) return first;
    const other = on(preferred === "EMAIL" ? "WHATSAPP" : "EMAIL");
    return other.ok ? other : { ok: false, reason: "No mobile number or email address" };
}

/** What a campaign may say, before anyone presses send. */
export const campaignSchema = z.object({
    name: z.string().trim().min(2, "Give the campaign a name so you can find it later").max(80),
    channel: z.enum(["WHATSAPP", "EMAIL"]),
    usePreferred: z.boolean().default(false),
    subject: z.string().trim().max(120).optional(),
    body: z.string().trim().min(5, "Write the message").max(1500, "Keep it under 1500 characters"),
});

export type CampaignInput = z.infer<typeof campaignSchema>;
