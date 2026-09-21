/**
 * Recognising someone who books online as a customer the workshop already
 * has. Pure, so the rules that decide "this is Courtney again" are tested —
 * a false match puts one person's car on another person's account.
 */

/** "N 12345 W", "n12345w" and "N-12345-W" are one plate. */
export function normalisePlate(plate: string): string {
    return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** The longest run of digits, to narrow a database search before comparing properly. */
export function plateDigits(plate: string): string {
    return (plate.match(/\d+/g) ?? []).sort((a, b) => b.length - a.length)[0] ?? "";
}

/**
 * "Toyota Hilux 2016" → make, model and year. People type these any way they
 * like, so it takes the first word as the make and the rest as the model, and
 * a plausible four-digit year from anywhere.
 */
export function parseVehicleDescription(text: string | null | undefined, thisYear = new Date().getFullYear()): { make: string; model: string; year: number | null } {
    const words = (text ?? "").trim().split(/\s+/).filter(Boolean);
    const yearIndex = words.findIndex((w) => /^(19|20)\d{2}$/.test(w) && Number(w) <= thisYear + 1);
    const year = yearIndex >= 0 ? Number(words[yearIndex]) : null;
    const rest = words.filter((_, i) => i !== yearIndex);
    if (rest.length === 0) return { make: "Unknown", model: "Unknown", year };
    const title = (w: string) => (w.length <= 3 && /^[A-Za-z]+$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1));
    return { make: title(rest[0]), model: rest.length > 1 ? rest.slice(1).map(title).join(" ") : "Unknown", year };
}

export type VehicleMatch = { id: string; plate: string; customerId: string | null };

/**
 * Whether a vehicle on file can be attached to the booking. A car already on
 * somebody else's account is not quietly moved — it is flagged for a person
 * to sort out, because a car can be sold and a plate can be mistyped.
 */
export function vehicleDecision(match: VehicleMatch | null, customerId: string | null): "attach" | "adopt" | "conflict" | "create" {
    if (!match) return "create";
    if (!match.customerId) return "adopt";
    return match.customerId === customerId ? "attach" : "conflict";
}
