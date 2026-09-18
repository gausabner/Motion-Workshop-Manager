/**
 * Phone numbers as WhatsApp needs them: international, digits only, no "+".
 *
 * Namibian workshops write numbers the local way — "081 744 4912" — and wa.me
 * rejects that outright. A local number is assumed to be in the workshop's own
 * country, which is right for nearly every customer a workshop has.
 */

/** Southern African dialing codes. A workshop elsewhere still works with numbers written in full. */
export const DIALING_CODES: Record<string, string> = {
    NA: "264",
    ZA: "27",
    BW: "267",
    ZM: "260",
    ZW: "263",
    AO: "244",
    LS: "266",
    SZ: "268",
    MZ: "258",
};

/** E.164 allows at most 15 digits; nothing real is shorter than 8. */
const plausible = (digits: string): string | null => (digits.length >= 8 && digits.length <= 15 ? digits : null);

export function toInternational(raw: string | null | undefined, country = "NA"): string | null {
    if (!raw) return null;
    const written = raw.trim();
    let digits = written.replace(/\D/g, "");
    if (!digits) return null;

    if (written.startsWith("+")) return plausible(digits);
    if (digits.startsWith("00")) return plausible(digits.slice(2));

    const code = DIALING_CODES[country.toUpperCase()];
    if (digits.startsWith("0")) return code ? plausible(code + digits.slice(1)) : null;
    if (code && digits.startsWith(code) && digits.length > code.length + 7) return plausible(digits);
    // A bare subscriber number with the leading zero dropped: "817444912".
    if (code && digits.length >= 7 && digits.length <= 10) digits = code + digits;
    return plausible(digits);
}

/** How a number is shown back to a person, so they can check it is the right one. */
export function displayInternational(digits: string): string {
    return `+${digits}`;
}
