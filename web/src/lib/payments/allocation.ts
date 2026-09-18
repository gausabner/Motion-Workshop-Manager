import type { DocumentType } from "@prisma/client";
import { clampAllocation } from "@/lib/documents/settlement";
import { round2 } from "@/lib/documents/totals";

/**
 * Allocation arithmetic (R2). Pure functions over plain numbers, shared by the
 * receipt screen and the server action that posts it, so what the counter sees
 * while typing is computed by the same code that validates the post.
 *
 * `outstanding` is signed: positive on an invoice the customer owes, negative
 * on a credit note the workshop owes back. An allocation carries the sign of
 * the item it lands on, so the sum of the allocations is the money that has to
 * change hands — which is what the tenders must cover.
 */

export type OpenItem = {
    id: string;
    type: DocumentType;
    number: string | null;
    /** ISO date strings: these cross the server → client boundary. */
    postDate: string;
    dueDate: string | null;
    reference: string | null;
    total: number;
    outstanding: number;
};

/** Document id → signed amount. Absent or zero means nothing is allocated to it. */
export type Allocations = Record<string, number>;

/** Oldest first, by the date the money fell due, then by number so the order is stable. */
export function byAge(a: OpenItem, b: OpenItem): number {
    const key = (i: OpenItem) => i.dueDate ?? i.postDate;
    return key(a).localeCompare(key(b)) || (a.number ?? "").localeCompare(b.number ?? "");
}

export function allocationTotal(allocations: Allocations): number {
    return round2(Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0));
}

/**
 * What the "All" button does: settle as much as it can, oldest first, using the
 * money tendered and topping it up from any credit notes on the account.
 *
 * Credit is only drawn on for the part the tender does not cover, and never
 * beyond what is actually owed — burning a N$1,820 credit note against a
 * N$1,200 invoice would leave the workshop owing N$620 back, which is a refund
 * and not something a receipt can do. Whatever is left of the credit stays on
 * the account for next time.
 *
 * With nothing tendered this is a pure credit application, which is how a
 * credit note gets used against an invoice without a payment being faked.
 */
export function spread(items: OpenItem[], tendered: number): Allocations {
    const out: Allocations = {};
    const ordered = [...items].sort(byAge);
    const invoices = ordered.filter((i) => i.outstanding > 0);
    const credits = ordered.filter((i) => i.outstanding < 0);

    const owed = round2(invoices.reduce((sum, i) => sum + i.outstanding, 0));
    const onHand = round2(Math.max(Number(tendered) || 0, 0));
    let wanted = round2(Math.max(owed - onHand, 0));

    let drawn = 0;
    for (const credit of credits) {
        if (wanted <= 0) break;
        const take = round2(Math.min(wanted, -credit.outstanding));
        out[credit.id] = -take;
        drawn = round2(drawn + take);
        wanted = round2(wanted - take);
    }

    let available = round2(onHand + drawn);
    for (const invoice of invoices) {
        if (available <= 0) break;
        const take = round2(Math.min(available, invoice.outstanding));
        out[invoice.id] = take;
        available = round2(available - take);
    }
    return out;
}

/**
 * The refund equivalent of `spread`: draw the credit notes down, oldest first,
 * until what is being paid out is accounted for. Invoices are ignored — an
 * unpaid invoice is not something a workshop can refund.
 */
export function spreadRefund(items: OpenItem[], payingOut: number): Allocations {
    const out: Allocations = {};
    let remaining = round2(Math.max(Number(payingOut) || 0, 0));
    for (const credit of [...items].filter((i) => i.outstanding < 0).sort(byAge)) {
        if (remaining <= 0) break;
        const take = round2(Math.min(remaining, -credit.outstanding));
        out[credit.id] = -take;
        remaining = round2(remaining - take);
    }
    return out;
}

/** The most that can be handed back: every open credit note, plus money already on account. */
export function refundable(items: OpenItem[], unapplied: number): number {
    const credits = items.reduce((sum, i) => sum + Math.min(i.outstanding, 0), 0);
    return round2(Math.max(-credits + (Number(unapplied) || 0), 0));
}

/** Drop the zeroes, and trim anything the document cannot actually absorb. */
export function normalise(items: OpenItem[], allocations: Allocations): Allocations {
    const byId = new Map(items.map((i) => [i.id, i]));
    const out: Allocations = {};
    for (const [id, raw] of Object.entries(allocations)) {
        const item = byId.get(id);
        if (!item) continue;
        const amount = clampAllocation(item.outstanding, Number(raw) || 0);
        if (amount !== 0) out[id] = amount;
    }
    return out;
}

export const AGEING_BUCKETS = ["current", "d30", "d60", "d90"] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

export const AGEING_LABELS: Record<AgeingBucket, string> = {
    current: "Current",
    d30: "30 days",
    d60: "60 days",
    d90: "90+ days",
};

/** Which statement column an item falls into, by how long it has been overdue. */
export function ageingBucket(dueDate: string | Date, asAt: Date = new Date()): AgeingBucket {
    const due = typeof dueDate === "string" ? new Date(`${dueDate.slice(0, 10)}T00:00:00Z`) : dueDate;
    const days = Math.floor((asAt.getTime() - due.getTime()) / 86_400_000);
    if (days < 30) return "current";
    if (days < 60) return "d30";
    if (days < 90) return "d60";
    return "d90";
}

export type Ageing = Record<AgeingBucket, number> & { total: number };

export function emptyAgeing(): Ageing {
    return { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
}

/**
 * Take money already sitting on the account off the newest bucket.
 *
 * Without this an ageing strip sums to more than the balance printed beside
 * it, and a customer who has already paid gets chased for it — which is the
 * fastest way to lose them.
 */
export function netUnapplied(ageing: Ageing, unapplied: number): Ageing {
    const credit = round2(Number(unapplied) || 0);
    if (credit === 0) return ageing;
    return { ...ageing, current: round2(ageing.current - credit), total: round2(ageing.total - credit) };
}

/** Sum the outstanding of every open item into its bucket. */
export function ageItems(items: { dueDate: string | Date | null; postDate: string | Date; outstanding: number }[], asAt: Date = new Date()): Ageing {
    const out = emptyAgeing();
    for (const item of items) {
        const bucket = ageingBucket(item.dueDate ?? item.postDate, asAt);
        out[bucket] = round2(out[bucket] + item.outstanding);
        out.total = round2(out.total + item.outstanding);
    }
    return out;
}
