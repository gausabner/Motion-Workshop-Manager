/** Display helpers — locale defaults for Namibia (en-NA, N$). */

export function money(value: number | string | null | undefined, currency = "NAD"): string {
    const n = typeof value === "string" ? Number(value) : value ?? 0;
    const symbol = currency === "ZAR" ? "R" : "N$";
    return `${symbol} ${n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dateShort(d: Date | string | null | undefined): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

/** yyyy-mm-dd for <input type="date"> defaults. */
export function dateInput(d: Date | string | null | undefined): string {
    if (!d) return "";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toISOString().slice(0, 10);
}

/** wa.me link for an E.164-ish number; null when the number is unusable. */
export function whatsappLink(mobile: string | null | undefined): string | null {
    if (!mobile) return null;
    const digits = mobile.replace(/[^\d]/g, "");
    if (digits.length < 9) return null;
    return `https://wa.me/${digits}`;
}

export function fullName(p: { firstName: string; lastName?: string | null }): string {
    return [p.firstName, p.lastName].filter(Boolean).join(" ");
}
