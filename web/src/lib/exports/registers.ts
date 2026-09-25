import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import type { Section } from "@/lib/pdf/register";
import { col, countRows, dec, iso, stamp, type Register } from "@/lib/exports/kit";
import { salesFor } from "@/lib/accounting/queries";
import { auditForPeriod } from "@/lib/audit/period";
import { sequenceAudit, unexplained } from "@/lib/documents/gaps";
import { vatSummary } from "@/lib/accounting/vat";
import { cashBook } from "@/lib/accounting/cashbook";
import { listReceivables } from "@/lib/payments/queries";
import { AGEING_BUCKETS, AGEING_LABELS } from "@/lib/payments/allocation";

/**
 * The six exports a council audit asks for.
 *
 * Each is a `Register` — defined once and rendered twice, as the PDF that gets
 * filed and the CSV that gets re-added. The shared shape, the formatters and
 * the CSV renderer live in `kit.ts`, and the reasoning for writing money and
 * dates the way these do is there too.
 */

export const REPORTS = ["transactions", "sequence", "sales", "vat", "cashbook", "debtors"] as const;
export type ReportName = (typeof REPORTS)[number];

export const REPORT_TITLES: Record<ReportName, string> = {
    transactions: "Transaction log",
    sequence: "Number sequence and gaps",
    sales: "Sales register",
    vat: "Tax summary",
    cashbook: "Cash book",
    debtors: "Debtors age analysis",
};

// -- The six -----------------------------------------------------------------

export async function transactionsRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date, actorUserId?: string): Promise<Register> {
    const rows = await auditForPeriod(db, { from, to, actorUserId }, 0, 50_000);
    return {
        title: REPORT_TITLES.transactions,
        rows: rows.length,
        sections: [{
            columns: [
                col("at", "When", 78), col("actor", "Who", 85), col("action", "What", 80),
                col("entity", "Record", 75, "left", true), col("reference", "Reference", 100), col("detail", "Detail", 93.28, "left", true),
            ],
            rows: rows.map((r) => ({
                at: stamp(r.at, tenant.timezone), actor: r.actor, action: r.action,
                entity: r.entity, reference: r.reference, detail: r.detail,
            })),
            empty: "Nobody did anything to anything in this period, which is worth checking twice.",
        }],
        notes: [
            `Times are ${tenant.timezone}. Events are in the order they happened.`,
            "An event with no signed-in user came from a customer's own device through a share link, or from a scheduled job.",
        ],
    };
}

export async function sequenceRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date): Promise<Register> {
    const audits = await sequenceAudit(db, from, to);
    const holes = unexplained(audits);

    const summary: Section = {
        heading: "Every sequence in the period",
        columns: [
            col("label", "Sequence", 110), col("range", "Range", 130),
            col("issued", "Issued", 60, "right"), col("expected", "Expected", 65, "right"),
            col("unexplained", "Unexplained", 76.28, "right"), col("unused", "Taken, unused", 70, "right"),
        ],
        rows: audits.map((a) => ({
            label: a.label,
            range: a.first && a.last ? `${a.first} – ${a.last}` : "—",
            issued: String(a.issued),
            expected: String(a.expected),
            unexplained: String(a.gaps.filter((g) => !g.accounted).length),
            unused: String(a.allocatedUnused),
        })),
        empty: "No numbered documents in this period.",
    };

    const gaps: Section = {
        heading: "Every gap, and what accounts for it",
        columns: [
            col("sequence", "Sequence", 95), col("number", "Number", 85),
            col("status", "Status", 90), col("explanation", "What accounts for it", 241.28),
        ],
        rows: audits.flatMap((a) =>
            a.gaps.map((g) => ({
                sequence: a.label, number: g.number,
                status: g.accounted ? "Accounted for" : "Unexplained",
                explanation: g.explanation || "Nothing in MOTION accounts for this number.",
            })),
        ),
        empty: "No gaps. Every number between the first and last issued is on the books.",
    };

    return {
        title: REPORT_TITLES.sequence,
        rows: countRows([summary, gaps]),
        sections: [summary, gaps],
        notes: [
            holes === 0
                ? "No unexplained gaps in this period."
                : `${holes} number${holes === 1 ? "" : "s"} in this period cannot be accounted for. Each one is listed above.`,
            "A voided document keeps its number and is not a gap — it appears in the register at nil value.",
            "“Taken, unused” counts numbers the counter handed out above the last one on the books: a document that was started and never finished. It is not a missing document.",
        ],
    };
}

export async function salesRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date): Promise<Register> {
    const sales = await salesFor(db, from, to);
    const sum = (pick: (r: (typeof sales)[number]) => number) => sales.reduce((t, r) => t + pick(r), 0);
    const c = tenant.currency;

    return {
        title: REPORT_TITLES.sales,
        rows: sales.length,
        sections: [{
            columns: [
                col("date", "Date", 58), col("number", "Number", 62), col("customer", "Customer", 120),
                col("description", "Description", 110, "left", true),
                col("net", `Net (${c})`, 53, "right"), col("tax", `Tax (${c})`, 45, "right"), col("total", `Total (${c})`, 63.28, "right"),
            ],
            rows: sales.map((r) => ({
                date: r.date, number: r.number, customer: r.customer, description: r.description,
                net: dec(r.net), tax: dec(r.tax), total: dec(r.total),
            })),
            empty: "Nothing was invoiced in this period.",
        }],
        totals: [
            { label: `Net (${c})`, value: dec(sum((r) => r.net)) },
            { label: `Tax (${c})`, value: dec(sum((r) => r.tax)) },
            { label: `Total (${c})`, value: dec(sum((r) => r.total)), strong: true },
        ],
        notes: ["Credit notes are included with their signs reversed, so the totals are net of credits."],
    };
}

export async function vatRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date): Promise<Register> {
    const v = await vatSummary(db, from, to);
    const c = tenant.currency;
    const bandColumns = [
        col("name", "Tax", 140), col("rate", "Rate", 60, "right"), col("documents", "Documents", 80, "right"),
        col("net", `Net (${c})`, 110, "right"), col("tax", `Tax (${c})`, 121.28, "right"),
    ];
    const asRows = (bands: typeof v.output) =>
        bands.map((b) => ({ name: b.name, rate: `${b.rate.toFixed(2)}%`, documents: String(b.documents), net: dec(b.net), tax: dec(b.tax) }));

    const sections: Section[] = [
        { heading: "Output tax — what was charged on sales", columns: bandColumns, rows: asRows(v.output), empty: "Nothing was invoiced in this period." },
        { heading: "Input tax — what was charged by suppliers", columns: bandColumns, rows: asRows(v.input), empty: "No supplier invoices in this period." },
    ];

    return {
        title: REPORT_TITLES.vat,
        rows: countRows(sections),
        sections,
        totals: [
            { label: `Output tax (${c})`, value: dec(v.outputTax) },
            { label: `Input tax (${c})`, value: dec(v.inputTax) },
            { label: v.payable >= 0 ? `Payable (${c})` : `Refundable (${c})`, value: dec(Math.abs(v.payable)), strong: true },
        ],
        notes: [
            "Rates are the ones stamped on each document when it was raised, not today's setting, so a period spanning a rate change shows both bands.",
            v.excludedInternal > 0
                ? `${v.excludedInternal} internal job${v.excludedInternal === 1 ? " is" : "s are"} excluded from output tax: work the workshop did on its own vehicles is not a sale.`
                : "",
            "This is a summary for preparing a return. It is not the return.",
        ].filter(Boolean),
    };
}

export async function cashbookRegister(db: TenantDb, tenant: Tenant, from: Date, to: Date): Promise<Register> {
    const book = await cashBook(db, from, to);
    const c = tenant.currency;
    const rowColumns = (party: string) => [
        col("date", "Date", 58), col("number", "Number", 62), col("party", party, 120),
        col("method", "How", 90), col("reference", "Reference", 90, "left", true), col("amount", `Amount (${c})`, 91.28, "right"),
    ];
    const summaryColumns = [col("method", "How", 200), col("count", "Movements", 100, "right"), col("amount", `Amount (${c})`, 211.28, "right")];
    const asRows = (rows: typeof book.received) =>
        rows.map((r) => ({ date: r.date, number: r.number, party: r.party, method: r.method, reference: r.reference ?? "", amount: dec(r.amount) }));
    const asTotals = (rows: typeof book.receivedBy) => rows.map((r) => ({ method: r.method, count: String(r.count), amount: dec(r.amount) }));

    const sections: Section[] = [
        { heading: "Received, by method", columns: summaryColumns, rows: asTotals(book.receivedBy), empty: "Nothing was received in this period." },
        { heading: "Paid out, by method", columns: summaryColumns, rows: asTotals(book.paidBy), empty: "Nothing was paid out in this period." },
        { heading: "Every receipt", columns: rowColumns("Customer"), rows: asRows(book.received), empty: "Nothing was received in this period." },
        { heading: "Every supplier payment", columns: rowColumns("Supplier"), rows: asRows(book.paid), empty: "Nothing was paid out in this period." },
    ];

    return {
        title: REPORT_TITLES.cashbook,
        rows: countRows(sections),
        sections,
        totals: [
            { label: `Received (${c})`, value: dec(book.receivedTotal) },
            { label: `Paid out (${c})`, value: dec(book.paidTotal) },
            { label: `Net movement (${c})`, value: dec(book.receivedTotal - book.paidTotal), strong: true },
        ],
        notes: [
            "A receipt split across two methods appears twice, once per method, because the split is what gets reconciled. The number of rows is not the number of receipts.",
            "Refunds are negative, so a method's total is what actually moved.",
        ],
    };
}

export async function debtorsRegister(db: TenantDb, tenant: Tenant, asAt: Date): Promise<Register> {
    const { rows, totals: aged, unapplied } = await listReceivables(db, asAt);
    const c = tenant.currency;

    return {
        title: REPORT_TITLES.debtors,
        rows: rows.length,
        sections: [{
            columns: [
                col("name", "Customer", 120), col("oldest", "Oldest due", 65),
                ...AGEING_BUCKETS.map((b) => col(b, `${AGEING_LABELS[b]} (${c})`, 63.75, "right")),
                col("owing", `Owing (${c})`, 71.28, "right"),
            ],
            rows: rows.map((r) => ({
                name: r.name, oldest: r.oldestDue ?? "",
                ...Object.fromEntries(AGEING_BUCKETS.map((b) => [b, dec(r.ageing[b])])),
                owing: dec(r.ageing.total),
            })),
            empty: "Nobody owes anything. Every invoice on the books is settled.",
        }],
        totals: [
            ...AGEING_BUCKETS.map((b) => ({ label: `${AGEING_LABELS[b]} (${c})`, value: dec(aged[b]) })),
            { label: `Owing (${c})`, value: dec(aged.total), strong: true },
        ],
        notes: [
            `Aged from the due date, as at ${iso(asAt)}.`,
            unapplied !== 0
                ? `${dec(Math.abs(unapplied))} ${c} of ${unapplied > 0 ? "payments" : "credits"} is not yet applied to an invoice, and is not in the buckets above.`
                : "",
        ].filter(Boolean),
    };
}
