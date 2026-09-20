import type { SerialState } from "@prisma/client";

/**
 * Serial numbers, as one physical unit each.
 *
 * The point is the question a customer asks two years later: "this battery
 * failed" — which one, when did it leave, what did it cost, and is it still
 * under warranty. Everything here exists to make that answerable from the
 * serial alone.
 */

/** Serials as people type them: commas, spaces or one per line, in any mixture. */
export function parseSerials(text: string | null | undefined): string[] {
    if (!text) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of text.split(/[\n,;]+|\s{2,}/)) {
        const serial = raw.trim().replace(/\s+/g, " ").toUpperCase();
        if (!serial || seen.has(serial)) continue;
        seen.add(serial);
        out.push(serial.slice(0, 60));
    }
    return out;
}

export function formatSerials(serials: string[]): string {
    return serials.join(", ");
}

/**
 * Why a line's serials do not match what it is selling, or null when they do.
 * A serialised line must name exactly as many units as it moves — no more, and
 * none missing, or the next warranty claim has nothing to point at.
 */
export function serialCountError(requiresSerial: boolean, quantity: number, serials: string[]): string | null {
    if (!requiresSerial) return null;
    const needed = Math.abs(Math.round(quantity));
    if (needed === 0) return null;
    if (serials.length === 0) return `This line needs ${needed} serial number${needed === 1 ? "" : "s"}.`;
    if (serials.length !== needed) {
        return `This line covers ${needed} unit${needed === 1 ? "" : "s"} but names ${serials.length} serial number${serials.length === 1 ? "" : "s"}.`;
    }
    return null;
}

/** Whole months from a date; the day of the month is kept where it exists. */
export function warrantyUntil(soldOn: Date, months: number | null | undefined): Date | null {
    if (!months || months <= 0) return null;
    const day = soldOn.getUTCDate();
    const end = new Date(Date.UTC(soldOn.getUTCFullYear(), soldOn.getUTCMonth() + months, 1));
    const lastOfMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
    end.setUTCDate(Math.min(day, lastOfMonth));
    return end;
}

export function inWarranty(warrantyEnds: Date | null, asAt: Date): boolean {
    return warrantyEnds !== null && warrantyEnds >= asAt;
}

export const SERIAL_STATE_LABELS: Record<SerialState, string> = {
    IN_STOCK: "On the shelf",
    SOLD: "Sold",
    RETURNED: "Came back",
    WRITTEN_OFF: "Written off",
};

/** What can be sold: in stock, or back from a customer and fit to go out again. */
export function sellable(state: SerialState): boolean {
    return state === "IN_STOCK" || state === "RETURNED";
}

/** Why these serials cannot go out on a sale, or null when they can. */
export function allocationError(
    serials: string[],
    known: { serial: string; state: SerialState; documentLineId: string | null }[],
    documentLineId: string | null,
): string | null {
    const byserial = new Map(known.map((k) => [k.serial, k]));
    for (const serial of serials) {
        const unit = byserial.get(serial);
        // A serial nobody booked in is allowed — plenty arrive before the paperwork — but one already sold is not.
        if (!unit) continue;
        if (unit.documentLineId && unit.documentLineId === documentLineId) continue;
        if (!sellable(unit.state)) {
            return unit.state === "SOLD" ? `${serial} has already been sold.` : `${serial} was written off and cannot be sold.`;
        }
    }
    return null;
}
