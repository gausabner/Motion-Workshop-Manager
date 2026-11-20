import type { JobStatus, RequisitionState } from "@prisma/client";

/**
 * Issuing from stores, as rules. Pure, so what may leave the shelf, and what
 * the job card says while it waits for parts, are tested without a database.
 *
 * What a line still needs is read from what has been issued against it, never
 * stored: a number kept beside the movements is a number that can disagree
 * with them.
 */

export type IssueLine = {
    id: string;
    description: string;
    /** What the requisition asked for. */
    quantity: number;
    /** What stores has issued against it so far. */
    issued: number;
    /** Whether it is a stock item stores can hand over; a service or an item typed in by hand is bought, not issued. */
    stocked: boolean;
    /** What the shelf holds now, for a stock item. */
    onHand?: number | null;
};

/** A person on the form: their name and pay number. */
export type Signatory = { membershipId: string | null; name: string; payNumber?: string | null };

const same = (a: string | null | undefined, b: string | null | undefined) => {
    const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return !!norm(a) && norm(a) === norm(b);
};

const round = (n: number) => Math.round(n * 100) / 100;

export function outstanding(line: Pick<IssueLine, "quantity" | "issued">): number {
    return Math.max(0, round(line.quantity - line.issued));
}

/** Every line has had all it asked for. */
export function fullyIssued(lines: Pick<IssueLine, "quantity" | "issued">[]): boolean {
    return lines.length > 0 && lines.every((l) => outstanding(l) === 0);
}

/** Why this issue cannot be made, or null when it can. */
export function issueError(input: {
    state: RequisitionState;
    kind: "STORES" | "PURCHASE";
    lines: IssueLine[];
    /** Quantities to hand over now, by line. */
    issue: { lineId: string; quantity: number }[];
    issuer: Signatory & { membershipId: string };
    receiver: Signatory;
}): string | null {
    if (input.kind !== "STORES") return "Only a stores requisition is issued from stock.";
    if (input.state !== "APPROVED") return input.state === "AWAITING_FINALISE" || input.state === "CLOSED" ? "Everything on it has been issued." : "It has not been approved yet, so nothing can leave the shelf against it.";
    const { issuer, receiver } = input;
    if (!receiver.name.trim()) return "Name the person receiving the parts.";
    // Somebody without a login is recorded by name and pay number, as the form asks; a name alone proves nothing to an auditor.
    if (!receiver.membershipId && !receiver.payNumber?.trim()) return "Enter the receiver's pay number. Somebody without a login is recorded by name and pay number.";
    // The issuer is not the receiver however they are named: by login, by pay number, or by their name typed in.
    if (receiver.membershipId === issuer.membershipId || same(receiver.payNumber, issuer.payNumber) || same(receiver.name, issuer.name)) {
        return "The person issuing cannot also be the one receiving. Name who is taking the parts.";
    }
    const handing = input.issue.filter((i) => i.quantity > 0);
    if (!handing.length) return "Enter how many of at least one item are being handed over.";
    for (const i of handing) {
        const line = input.lines.find((l) => l.id === i.lineId);
        if (!line) return "One of the lines is no longer on the requisition. Refresh the page.";
        if (!line.stocked) return `“${line.description}” is not a stock item, so it is bought rather than issued.`;
        const left = outstanding(line);
        if (round(i.quantity) > left) return `Only ${left} of “${line.description}” ${left === 1 ? "is" : "are"} still to be issued.`;
        // What leaves the shelf must be on it. A count that says otherwise is wrong, and is put right by a stock take, not by issuing.
        if (line.onHand != null && round(i.quantity) > round(line.onHand)) {
            const have = Math.max(0, round(line.onHand));
            return `Only ${have} of “${line.description}” ${have === 1 ? "is" : "are"} on the shelf. Issue what is there; the rest can follow.`;
        }
    }
    return null;
}

/** What stores should hand over by default: what is still needed, but never more than the shelf holds. */
export function issueDefault(line: Pick<IssueLine, "quantity" | "issued" | "stocked" | "onHand">): number {
    if (!line.stocked) return 0;
    const left = outstanding(line);
    return line.onHand == null ? left : Math.max(0, Math.min(left, round(line.onHand)));
}

/** A requisition still to be met: submitted, and not yet issued in full, cancelled or rejected. */
export const OPEN_STATES: RequisitionState[] = ["AWAITING_FOREMAN", "AWAITING_HEAD", "AWAITING_OVER_LIMIT", "APPROVED"];

/**
 * What the job card's status should become as its requisitions move: waiting
 * for parts while any is open, back to work in progress when none is. Only
 * statuses that mean "being worked on" are moved; a job someone has marked
 * complete, or that is waiting on its customer, is left alone. Null means no
 * change.
 */
export function partsStatus(current: JobStatus | null, open: number): JobStatus | null {
    if (open > 0) return current === "BOOKED_IN" || current === "WORK_IN_PROGRESS" || current === "INSPECTION_IN_PROGRESS" ? "WAITING_FOR_PARTS" : null;
    return current === "WAITING_FOR_PARTS" ? "WORK_IN_PROGRESS" : null;
}
