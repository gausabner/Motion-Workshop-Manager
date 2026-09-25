import "server-only";
import type { SequenceKey } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * The completeness test: is every number accounted for?
 *
 * This is the first thing a council auditor does and the most likely reason a
 * first audit goes badly. They take the invoice numbers for a period, check
 * that they run without a break, and ask about every break they find. A
 * workshop that cannot explain a missing invoice number is, as far as that
 * conversation goes, a workshop that might have deleted an invoice.
 *
 * MOTION can answer, because it has never reused a number and records every
 * deletion. What it has not done until now is present the answer.
 *
 * Two things this report deliberately does not do.
 *
 * It does not treat a **voided** document as a gap. A void leaves the document
 * and its number in place, which is the whole point of voiding; it shows up in
 * the register with nil value and needs no explanation here.
 *
 * It does not **block** anything. An unexplained gap is reported and recorded,
 * and the period still closes. Blocking would be stricter than any product in
 * this market and is a plausible selling point, but it would also stop a
 * workshop's month for a draft somebody tidied away — and the record, not the
 * refusal, is what an auditor actually asks for.
 */

export type Gap = {
    number: string;
    /** Empty when nothing accounts for it — which is the finding. */
    explanation: string;
    accounted: boolean;
};

export type SequenceAudit = {
    key: SequenceKey;
    label: string;
    prefix: string;
    first: string | null;
    last: string | null;
    issued: number;
    /** How many numbers the range should hold if none were lost. */
    expected: number;
    gaps: Gap[];
    /**
     * Numbers the counter handed out above the highest one in the period.
     * These are allocated-and-lost: a process that took a number and did not
     * finish. Harmless, common, and worth naming before somebody else does.
     */
    allocatedUnused: number;
};

const LABEL: Record<string, string> = {
    INVOICE: "Invoices",
    CREDIT: "Credit notes",
    RECEIPT: "Receipts",
    REFUND: "Refunds",
    JOB: "Job cards",
    QUOTE: "Quotes",
    PURCHASE_ORDER: "Purchase orders",
    SUPPLIER_PAYMENT: "Supplier payments",
};

/** The money sequences, in the order an auditor asks about them. */
export const AUDITED_SEQUENCES: SequenceKey[] = ["INVOICE", "CREDIT", "RECEIPT", "REFUND", "JOB", "PURCHASE_ORDER", "SUPPLIER_PAYMENT"];

/**
 * Split "INV-1042" into its prefix and 1042.
 *
 * Done by taking the trailing digits rather than by trusting the sequence's
 * stored prefix, because a workshop that changes its prefix mid-year still has
 * last year's numbers on the books and both must parse.
 */
function split(value: string): { prefix: string; n: number } | null {
    const match = /^(.*?)(\d+)$/.exec(value.trim());
    if (!match) return null;
    return { prefix: match[1], n: Number(match[2]) };
}

export async function sequenceAudit(db: TenantDb, from: Date, to: Date): Promise<SequenceAudit[]> {
    const [documents, payments, orders, supplierPayments, sequences, deletions] = await Promise.all([
        // Deliberately not filtered by state. A number belongs to whatever
        // holds it, whatever state that thing is in: a booking sitting in the
        // diary as a draft has a job number, and a voided invoice keeps the
        // number it was given. Filtering by state was the first version of
        // this, and it reported twenty missing job cards at a workshop that
        // had lost none — which is the one kind of wrong answer this report
        // must never give.
        db.document.findMany({
            where: { postDate: { gte: from, lte: to } },
            select: { type: true, number: true, jobNumber: true },
        }),
        db.payment.findMany({
            where: { postDate: { gte: from, lte: to }, number: { not: null } },
            select: { number: true, direction: true },
        }),
        db.purchaseOrder.findMany({ where: { orderDate: { gte: from, lte: to }, number: { not: null } }, select: { number: true } }),
        db.supplierPayment.findMany({ where: { postDate: { gte: from, lte: to }, number: { not: null } }, select: { number: true } }),
        db.sequence.findMany({ select: { key: true, prefix: true, next: true } }),
        // Every deletion MOTION has ever recorded, so a gap can be explained by
        // one even when the deletion happened outside the period being audited.
        db.auditEvent.findMany({ where: { action: "DELETED" }, select: { at: true, diff: true, actorUserId: true } }),
    ]);

    const numbersFor = (key: SequenceKey): string[] => {
        switch (key) {
            case "INVOICE": return documents.filter((d) => d.type === "INVOICE" || d.type === "CASH_SALE").map((d) => d.number).filter((n): n is string => !!n);
            case "CREDIT": return documents.filter((d) => d.type === "CREDIT").map((d) => d.number).filter((n): n is string => !!n);
            case "QUOTE": return documents.filter((d) => d.type === "QUOTE").map((d) => d.number).filter((n): n is string => !!n);
            case "JOB": return documents.map((d) => d.jobNumber).filter((n): n is string => !!n);
            case "RECEIPT": return payments.filter((p) => p.direction === "RECEIPT").map((p) => p.number!).filter(Boolean);
            case "REFUND": return payments.filter((p) => p.direction === "REFUND").map((p) => p.number!).filter(Boolean);
            case "PURCHASE_ORDER": return orders.map((o) => o.number!).filter(Boolean);
            case "SUPPLIER_PAYMENT": return supplierPayments.map((p) => p.number!).filter(Boolean);
            default: return [];
        }
    };

    // A deletion is indexed by the number that was on the document, which is
    // the only thing that ties a hole in the sequence back to an act.
    const deleted = new Map<string, string>();
    for (const event of deletions) {
        const diff = event.diff as Record<string, unknown> | null;
        if (!diff) continue;
        const snap = (diff.snapshot ?? diff) as Record<string, unknown>;
        const reason = typeof diff.reason === "string" ? diff.reason : typeof snap.deletedBecause === "string" ? snap.deletedBecause : null;
        const when = event.at.toISOString().slice(0, 10);
        for (const field of ["number", "jobNumber"]) {
            const value = snap[field];
            if (typeof value === "string" && value) {
                deleted.set(value, `Deleted ${when}${reason ? ` — ${reason}` : ""}`);
            }
        }
    }

    const byKey = new Map(sequences.map((s) => [s.key, s]));

    return AUDITED_SEQUENCES.map((key) => {
        const seq = byKey.get(key);
        const prefix = seq?.prefix ?? "";
        const parsed = numbersFor(key).map(split).filter((p): p is { prefix: string; n: number } => p !== null);
        const label = LABEL[key] ?? key;

        if (parsed.length === 0) {
            return { key, label, prefix, first: null, last: null, issued: 0, expected: 0, gaps: [], allocatedUnused: 0 };
        }

        const present = new Set(parsed.map((p) => p.n));
        const low = Math.min(...present);
        const high = Math.max(...present);
        // The prefix actually in use for this period, which may differ from
        // the one the sequence would hand out today.
        const inUse = parsed[parsed.length - 1].prefix || prefix;

        const gaps: Gap[] = [];
        for (let n = low; n <= high; n += 1) {
            if (present.has(n)) continue;
            const number = `${inUse}${n}`;
            const explanation = deleted.get(number) ?? "";
            gaps.push({ number, explanation, accounted: explanation.length > 0 });
        }

        // `next` is the value the counter will hand out, so `next - 1` is the
        // last one it gave away. Anything above the highest number on the books
        // was taken and never used.
        const lastAllocated = seq ? seq.next - 1 : high;
        const allocatedUnused = Math.max(0, lastAllocated - high);

        return {
            key, label, prefix: inUse,
            first: `${inUse}${low}`, last: `${inUse}${high}`,
            issued: present.size, expected: high - low + 1,
            gaps, allocatedUnused,
        };
    }).filter((s) => s.issued > 0 || s.gaps.length > 0);
}

/** The one number a council wants on the cover: how many holes nobody can explain. */
export function unexplained(audits: SequenceAudit[]): number {
    return audits.reduce((total, a) => total + a.gaps.filter((g) => !g.accounted).length, 0);
}
