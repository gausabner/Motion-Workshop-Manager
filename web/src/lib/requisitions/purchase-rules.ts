import { outstanding, type IssueLine } from "@/lib/requisitions/stores-rules";

/**
 * Buying what stores cannot issue, as rules. Pure, so what is split off, and
 * how an order is priced from the quotation the approvers chose, are tested
 * without a database.
 */

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * What a stores requisition cannot meet from the shelf, line by line: all of
 * an item stores does not keep, and the part of a stock item the shelf is
 * short of. This is what stores turns into a purchase requisition.
 */
export function shortfall(lines: Pick<IssueLine, "id" | "quantity" | "issued" | "moved" | "stocked" | "onHand">[]): { lineId: string; quantity: number }[] {
    const out: { lineId: string; quantity: number }[] = [];
    for (const l of lines) {
        const left = outstanding(l);
        if (left <= 0) continue;
        const short = l.stocked ? round(left - Math.max(0, l.onHand ?? 0)) : left;
        if (short > 0) out.push({ lineId: l.id, quantity: short });
    }
    return out;
}

/** Why stores cannot split this requisition, or null when it can. */
export function splitError(input: { kind: "STORES" | "PURCHASE"; state: string; short: number }): string | null {
    if (input.kind !== "STORES") return "Only a stores requisition is split; a purchase requisition is bought as it stands.";
    if (input.state !== "APPROVED") return "Only an approved requisition is split. It has to be approved before anything is bought for it.";
    if (input.short === 0) return "Stores can meet everything still needed from the shelf, so there is nothing to buy.";
    return null;
}

/**
 * The order's prices, from the quotation the approvers chose: the supplier
 * quoted a total, so each line's estimate is scaled to it, and the order adds
 * up to what was approved. With no estimates to go by, the total is shared by
 * quantity. Rounded to the cent.
 */
export function pricedFromQuote(lines: { quantity: number; unitCost: number }[], amount: number): number[] {
    const estimate = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
    const units = lines.reduce((sum, l) => sum + l.quantity, 0);
    if (!lines.length || units <= 0) return lines.map(() => 0);
    return lines.map((l) => round(estimate > 0 ? (l.unitCost * amount) / estimate : amount / units));
}

/** Why the order cannot be raised, or null when it can. */
export function orderError(input: { kind: "STORES" | "PURCHASE"; state: string; chosen: boolean; ordered: boolean }): string | null {
    if (input.kind !== "PURCHASE") return "Only a purchase requisition becomes a purchase order.";
    if (input.state !== "APPROVED") return "It has to be approved before it is ordered.";
    if (!input.chosen) return "It has no chosen quotation to order from.";
    if (input.ordered) return "It has already been ordered. Open the purchase order to change it.";
    return null;
}
