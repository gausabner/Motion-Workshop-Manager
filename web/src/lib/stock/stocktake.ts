import { round2 } from "@/lib/documents/totals";

/**
 * Counting the shelves.
 *
 * The awkward case is a count that takes an hour while the workshop keeps
 * trading: what the sheet expected is no longer what the ledger says by the
 * time it is applied. So the adjustment is always worked out against the
 * ledger *now*, and any line that moved while it was being counted is flagged
 * rather than quietly written off.
 */

export type CountLine = {
    productId: string;
    /** What the ledger said when the sheet was drawn up. */
    expected: number;
    /** What was found on the shelf, or null when nobody has counted it. */
    counted: number | null;
    /** What the ledger says now, at the moment of applying. */
    onHand: number;
    unitCost: number;
};

export type LineOutcome = {
    productId: string;
    counted: number;
    /** Against the sheet: what the count says was wrong. */
    variance: number;
    /** What to post to the ledger to make it true, against what it says now. */
    adjustment: number;
    /** Stock moved between drawing up the sheet and applying it. */
    movedDuringCount: boolean;
    value: number;
};

/** What a counted line says versus what the sheet expected. */
export function variance(line: Pick<CountLine, "expected" | "counted">): number | null {
    return line.counted === null ? null : round2(line.counted - line.expected);
}

/** What a counted line is worth, over or short, at the cost it was valued at. */
export function varianceValue(line: CountLine): number {
    const v = variance(line);
    return v === null ? 0 : round2(v * line.unitCost);
}

/**
 * The movements to post. Uncounted lines are left alone — a sheet nobody
 * finished must not write every unvisited product down to nothing.
 */
export function outcomes(lines: CountLine[]): LineOutcome[] {
    const out: LineOutcome[] = [];
    for (const line of lines) {
        if (line.counted === null) continue;
        const adjustment = round2(line.counted - line.onHand);
        out.push({
            productId: line.productId,
            counted: line.counted,
            variance: round2(line.counted - line.expected),
            adjustment,
            movedDuringCount: round2(line.onHand) !== round2(line.expected),
            value: round2(adjustment * line.unitCost),
        });
    }
    return out;
}

export type CountSummary = {
    lines: number;
    counted: number;
    uncounted: number;
    agreeing: number;
    over: number;
    short: number;
    movedDuringCount: number;
    /** Positive means the shelves hold more than the books said. */
    value: number;
};

export function summarise(lines: CountLine[]): CountSummary {
    const done = outcomes(lines);
    return {
        lines: lines.length,
        counted: done.length,
        uncounted: lines.length - done.length,
        agreeing: done.filter((d) => d.variance === 0).length,
        over: done.filter((d) => d.variance > 0).length,
        short: done.filter((d) => d.variance < 0).length,
        movedDuringCount: done.filter((d) => d.movedDuringCount).length,
        value: round2(done.reduce((total, d) => total + round2(d.variance * (lines.find((l) => l.productId === d.productId)?.unitCost ?? 0)), 0)),
    };
}

export function applyError(state: string, counted: number): string | null {
    if (state !== "DRAFT") return "This count has already been applied.";
    if (counted === 0) return "Nothing has been counted yet.";
    return null;
}
