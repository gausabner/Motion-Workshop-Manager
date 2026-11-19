/**
 * The check bay's two inspections, as rules. Pure, so what they decide is
 * tested without a database.
 *
 * An item is checked once it is marked OK, Soon or Urgent (the inspection's
 * own red, amber and green). The check bay signs only when every item is
 * checked: a signature over items nobody looked at says something nobody
 * saw.
 *
 * - The assessment's red and amber findings become the job card's work.
 * - The quality check fails if any item is red. What failed is written on
 *   the signature, so the workshop it goes back to knows what to put right.
 */

export type CheckPurpose = "ASSESSMENT" | "QUALITY_CHECK";

export type CheckItem = { description: string; urgent: boolean; soon: boolean; checked: boolean; comment: string | null };

export const CHECK_LABEL: Record<CheckPurpose, string> = { ASSESSMENT: "assessment", QUALITY_CHECK: "quality check" };

const unchecked = (i: CheckItem) => !i.checked && !i.urgent && !i.soon;

export function checkProgress(items: CheckItem[]): { total: number; left: number; red: number; amber: number } {
    return {
        total: items.length,
        left: items.filter(unchecked).length,
        red: items.filter((i) => i.urgent).length,
        amber: items.filter((i) => !i.urgent && i.soon).length,
    };
}

/** Passed or failed once every item is checked; null while any is not. */
export function checkOutcome(items: CheckItem[]): "PASSED" | "FAILED" | null {
    if (items.some(unchecked)) return null;
    return items.some((i) => i.urgent) ? "FAILED" : "PASSED";
}

const describe = (i: CheckItem) => (i.comment?.trim() ? `${i.description}: ${i.comment.trim()}` : i.description);

/** What the signature says, in one line a foreman reads on the job card. Capped at the signature's 300 characters. */
export function checkSummary(purpose: CheckPurpose, items: CheckItem[]): string {
    const red = items.filter((i) => i.urgent);
    const amber = items.filter((i) => !i.urgent && i.soon);
    let line: string;
    if (purpose === "QUALITY_CHECK") {
        // The outcome is shown beside it, so the line says only what was found.
        line = red.length ? red.map(describe).join("; ") : `${items.length} ${items.length === 1 ? "item" : "items"} checked`;
    } else if (!red.length && !amber.length) {
        line = `Nothing found, ${items.length} ${items.length === 1 ? "item" : "items"} checked`;
    } else {
        const counts = [red.length && `${red.length} urgent`, amber.length && `${amber.length} soon`].filter(Boolean).join(", ");
        line = `${counts}: ${[...red, ...amber].map(describe).join("; ")}`;
    }
    return line.length > 300 ? `${line.slice(0, 299)}…` : line;
}

/** Why the check bay cannot sign yet, or null when it can. */
export function checkSignError(purpose: CheckPurpose, required: boolean, items: CheckItem[] | null): string | null {
    if (!items) return required ? `Start the ${CHECK_LABEL[purpose]} first: it is an inspection, and the signature goes on what it found.` : null;
    const { left } = checkProgress(items);
    if (left) return `Check every item first: ${left} of ${items.length} ${left === 1 ? "is" : "are"} not checked yet.`;
    return null;
}
