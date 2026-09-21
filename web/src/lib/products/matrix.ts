import type { MatrixBasis, PriceRounding } from "@prisma/client";
import { round2 } from "@/lib/documents/totals";

/**
 * Price matrices: what to charge for something, worked out from what it cost.
 *
 * Workshops price in bands — a five-dollar clip carries a far bigger
 * percentage than a gearbox — and the point of holding the bands is that when
 * a supplier puts a cost up, the sell price follows instead of quietly eating
 * the margin.
 */

export type Band = { costFrom: number; costTo: number | null; percent: number };
export type Matrix = { basis: MatrixBasis; rounding: PriceRounding; bands: Band[] };

/** The band a cost falls in: the last one whose range contains it, so later bands win an overlap. */
export function bandFor(cost: number, bands: Band[]): Band | null {
    const value = round2(cost);
    let found: Band | null = null;
    for (const band of [...bands].sort((a, b) => a.costFrom - b.costFrom)) {
        const from = round2(band.costFrom);
        const to = band.costTo === null ? Infinity : round2(band.costTo);
        if (value >= from && value <= to) found = band;
    }
    return found;
}

/** Tidy a calculated price the way a shelf edge wants it. Always upwards: rounding down gives margin away. */
export function roundPrice(price: number, rounding: PriceRounding): number {
    const value = round2(price);
    if (value <= 0) return 0;
    switch (rounding) {
        case "WHOLE": return Math.ceil(value);
        case "NEAREST_5": return Math.ceil(value / 5) * 5;
        case "NEAREST_10": return Math.ceil(value / 10) * 10;
        case "ENDS_99": return Math.max(0.99, Math.ceil(value) - 0.01);
        default: return value;
    }
}

/**
 * What to sell at, or null when the matrix says nothing about this cost —
 * a cost of nothing, or a gap between bands. Null means "leave the price
 * alone", never "make it free".
 */
export function priceFrom(cost: number, matrix: Matrix): number | null {
    const value = round2(cost);
    if (value <= 0) return null;
    const band = bandFor(value, matrix.bands);
    if (!band) return null;
    const percent = Number(band.percent);
    if (matrix.basis === "MARGIN") {
        // A margin of 100% or more has no finite price; treat it as unusable rather than infinity.
        if (percent >= 100 || percent < 0) return null;
        return roundPrice(value / (1 - percent / 100), matrix.rounding);
    }
    if (percent < 0) return null;
    return roundPrice(value * (1 + percent / 100), matrix.rounding);
}

/** What a price implies as a margin, for showing beside it. */
export function marginPercent(cost: number, price: number): number | null {
    if (price <= 0) return null;
    return round2(((price - cost) / price) * 100);
}

/** Bands that overlap or leave gaps are worth saying out loud before they price anything. */
export function matrixWarnings(bands: Band[]): string[] {
    const sorted = [...bands].sort((a, b) => a.costFrom - b.costFrom);
    const warnings: string[] = [];
    if (sorted.length === 0) return ["This matrix has no bands, so it cannot price anything."];
    if (round2(sorted[0].costFrom) > 0) warnings.push(`Nothing is priced below ${sorted[0].costFrom.toFixed(2)}.`);
    for (const [i, band] of sorted.entries()) {
        if (band.costTo !== null && round2(band.costTo) < round2(band.costFrom)) warnings.push(`A band runs from ${band.costFrom.toFixed(2)} to ${band.costTo.toFixed(2)}, which is backwards.`);
        const next = sorted[i + 1];
        if (!next) continue;
        if (band.costTo === null) {
            warnings.push("A band that runs to the top is not the last one; everything after it is unreachable.");
            continue;
        }
        const gap = round2(next.costFrom - round2(band.costTo));
        if (gap > 0.01) warnings.push(`Costs between ${band.costTo.toFixed(2)} and ${next.costFrom.toFixed(2)} fall in no band.`);
        if (gap < 0) warnings.push(`The bands from ${band.costFrom.toFixed(2)} and ${next.costFrom.toFixed(2)} overlap; the higher one wins.`);
    }
    if (sorted[sorted.length - 1].costTo !== null) warnings.push(`Nothing is priced above ${sorted[sorted.length - 1].costTo!.toFixed(2)}. Leave the last band's "to" empty to catch everything.`);
    return warnings;
}

/** The starting point a workshop can then edit: more margin on the cheap things. */
export const STARTER_BANDS: Band[] = [
    { costFrom: 0, costTo: 50, percent: 100 },
    { costFrom: 50.01, costTo: 200, percent: 75 },
    { costFrom: 200.01, costTo: 1000, percent: 55 },
    { costFrom: 1000.01, costTo: null, percent: 35 },
];
