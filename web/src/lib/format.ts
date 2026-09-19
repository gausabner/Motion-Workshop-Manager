/** Display helpers — locale defaults for Namibia (en-NA, N$). */

import { toInternational } from "@/lib/messaging/phone";

export function money(value: number | string | null | undefined, currency = "NAD"): string {
    const n = typeof value === "string" ? Number(value) : value ?? 0;
    const symbol = currency === "ZAR" ? "R" : "N$";
    // The sign goes in front of the symbol: "N$ -1,000.00" is not how anyone writes money.
    const sign = n < 0 ? "-" : "";
    return `${sign}${symbol} ${Math.abs(n).toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dateShort(d: Date | string | null | undefined): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/**
 * A moment, on the workshop's own clock. `dateShort` reads a date column,
 * which is stored at UTC midnight and must be read back that way; anything
 * that happened *at a time* — sent, acted on, created — belongs to the
 * workshop's day, or a message sent at 00:30 in Windhoek reads as yesterday.
 */
export function dateShortIn(d: Date | string | null | undefined, timeZone: string): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone });
}

/** yyyy-mm-dd for <input type="date"> defaults. */
export function dateInput(d: Date | string | null | undefined): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
}

/**
 * wa.me link for a customer's number; null when the number is unusable.
 *
 * Numbers are normalised first: stripping non-digits alone turned the way
 * Namibians actually write a number, "081 744 4912", into a link WhatsApp
 * rejects.
 */
export function whatsappLink(mobile: string | null | undefined, country = "NA"): string | null {
    const digits = toInternational(mobile, country);
    return digits ? `https://wa.me/${digits}` : null;
}

export function fullName(p: { firstName: string; lastName?: string | null }): string {
    return [p.firstName, p.lastName].filter(Boolean).join(" ");
}
