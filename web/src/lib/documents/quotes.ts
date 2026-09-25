import "server-only";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";

/**
 * What happened to the quotes: how many turned into work, how many did not,
 * and what the difference is worth.
 *
 * The conversion rate is the one number in MOTION that tells an owner whether
 * their pricing is wrong, and no screen has ever shown it. A workshop quoting
 * thirty jobs a month and winning six has a problem worth a morning; the same
 * workshop winning twenty-four does not.
 *
 * A quote counts as won when another document was raised from it — MOTION
 * already records that as `sourceDocumentId` when a quote is converted, so
 * this is read from what the workshop did, not from a status somebody
 * remembered to set. That is the whole reason the figure can be trusted.
 *
 * "Lost" is a judgement and is treated as one. A quote nobody converted and
 * whose follow-up date has passed is called lost; one still inside its window
 * is open. Neither is a state the workshop set, so the report says which rule
 * it used rather than presenting it as a fact — and that judgement is made as
 * at today, not as at the end of the period being reported on.
 */

const num = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** How long a quote with no follow-up date set is given before it is treated as lost. */
export const QUOTE_STALE_DAYS = 30;

export type QuoteOutcome = "Won" | "Open" | "Lost" | "Cancelled";

export type QuoteRow = {
    id: string;
    number: string;
    date: string;
    customer: string;
    vehicle: string;
    description: string;
    total: number;
    outcome: QuoteOutcome;
    /** The document it became, when it became one. */
    becameNumber: string;
    becameOn: string;
    /** Days from quote to conversion — how long the customer took to say yes. */
    daysToWin: number | null;
};

export async function quoteOutcomes(db: TenantDb, from: Date, to: Date, now: Date = new Date()): Promise<{
    rows: QuoteRow[];
    counts: Record<QuoteOutcome, number>;
    values: Record<QuoteOutcome, number>;
    quoted: number;
    conversionByCount: number | null;
    conversionByValue: number | null;
    averageDaysToWin: number | null;
}> {
    const quotes = await db.document.findMany({
        where: { type: "QUOTE", postDate: { gte: from, lte: to } },
        orderBy: [{ postDate: "asc" }],
        select: {
            id: true, number: true, postDate: true, followUpDate: true, total: true, description: true, state: true,
            customer: { select: { firstName: true, lastName: true } },
            vehicle: { select: { plate: true } },
            // What the quote turned into. A quote converted twice — split
            // across two payers — counts once, on the first thing raised.
            derivedDocuments: {
                where: { type: { in: ["JOB_CARD", "INVOICE", "CASH_SALE"] }, state: { not: "VOID" } },
                orderBy: { postDate: "asc" },
                take: 1,
                select: { number: true, jobNumber: true, postDate: true },
            },
        },
    });

    const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);

    const rows: QuoteRow[] = quotes.map((q) => {
        const became = q.derivedDocuments[0];
        // Judged against today, never against the end of the period asked for.
        // Comparing with the period end meant that asking for "this year" —
        // which ends in December — declared every live quote lost, because
        // every follow-up date was before the end of the period. A quote is
        // open or not open now; the period only decides which quotes are on
        // the report at all.
        const stale = q.followUpDate ?? new Date(q.postDate.getTime() + QUOTE_STALE_DAYS * 86_400_000);
        const outcome: QuoteOutcome = q.state === "VOID" ? "Cancelled" : became ? "Won" : stale < now ? "Lost" : "Open";
        return {
            id: q.id,
            number: q.number ?? "—",
            date: iso(q.postDate),
            customer: q.customer ? `${q.customer.firstName} ${q.customer.lastName}`.trim() : "Cash sale",
            vehicle: q.vehicle?.plate ?? "",
            description: q.description ?? "",
            total: num(q.total),
            outcome,
            becameNumber: became ? (became.number ?? became.jobNumber ?? "") : "",
            becameOn: became ? iso(became.postDate) : "",
            daysToWin: became ? Math.max(0, day(became.postDate) - day(q.postDate)) : null,
        };
    });

    const blank: Record<QuoteOutcome, number> = { Won: 0, Open: 0, Lost: 0, Cancelled: 0 };
    const counts = { ...blank };
    const values = { ...blank };
    for (const r of rows) {
        counts[r.outcome] += 1;
        values[r.outcome] = round2(values[r.outcome] + r.total);
    }

    // A cancelled quote is left out of the rate entirely: it was withdrawn
    // rather than turned down, and counting it as a loss would make a workshop
    // that tidies up look worse than one that does not.
    const decided = counts.Won + counts.Lost;
    const decidedValue = round2(values.Won + values.Lost);
    const won = rows.filter((r) => r.daysToWin !== null);

    return {
        rows,
        counts,
        values,
        quoted: round2(rows.reduce((t, r) => t + r.total, 0)),
        conversionByCount: decided === 0 ? null : round2((counts.Won / decided) * 100),
        conversionByValue: decidedValue === 0 ? null : round2((values.Won / decidedValue) * 100),
        averageDaysToWin: won.length === 0 ? null : round2(won.reduce((t, r) => t + (r.daysToWin ?? 0), 0) / won.length),
    };
}
