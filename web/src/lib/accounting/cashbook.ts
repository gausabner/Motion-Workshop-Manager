import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";

/**
 * Money in and money out, grouped by how it moved.
 *
 * A council reconciles cash against the safe, card against the merchant
 * statement and EFT against the bank — three different people on three
 * different days. One total for "receipts" is useless to all of them, which is
 * why this report exists separately from the sales register.
 *
 * A payment may be split across tenders: half cash, half card. The split is
 * what gets reconciled, so the rows come from the tender rather than from the
 * payment, and a payment with two tenders contributes to two methods. The
 * consequence worth knowing is that the number of rows here is not the number
 * of receipts.
 */

export type CashRow = {
    date: string;
    number: string;
    party: string;
    method: string;
    reference: string | null;
    /** Signed: a refund is negative, so a method's total is what actually moved. */
    amount: number;
};

export type MethodTotal = { method: string; count: number; amount: number };

export type CashBook = {
    received: CashRow[];
    paid: CashRow[];
    receivedBy: MethodTotal[];
    paidBy: MethodTotal[];
    receivedTotal: number;
    paidTotal: number;
};

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const nameOf = (c: { firstName: string; lastName: string } | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : "Cash sale");

function totalsByMethod(rows: CashRow[]): MethodTotal[] {
    const map = new Map<string, MethodTotal>();
    for (const r of rows) {
        const existing = map.get(r.method) ?? { method: r.method, count: 0, amount: 0 };
        existing.count += 1;
        existing.amount = round2(existing.amount + r.amount);
        map.set(r.method, existing);
    }
    return [...map.values()].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

export async function cashBook(db: TenantDb, from: Date, to: Date): Promise<CashBook> {
    const [payments, supplierPayments] = await Promise.all([
        db.payment.findMany({
            where: { state: "PROCESSED", postDate: { gte: from, lte: to } },
            orderBy: [{ postDate: "asc" }, { number: "asc" }],
            select: {
                number: true, postDate: true, amount: true, direction: true,
                customer: { select: { firstName: true, lastName: true } },
                tenders: { select: { amount: true, reference: true, method: { select: { name: true } } } },
            },
        }),
        db.supplierPayment.findMany({
            where: { state: "PROCESSED", postDate: { gte: from, lte: to } },
            orderBy: [{ postDate: "asc" }, { number: "asc" }],
            select: {
                number: true, postDate: true, amount: true, reference: true,
                method: { select: { name: true } },
                allocations: { select: { invoice: { select: { supplier: { select: { companyName: true } } } } } },
            },
        }),
    ]);

    const received: CashRow[] = [];
    for (const p of payments) {
        const sign = p.direction === "REFUND" ? -1 : 1;
        const party = nameOf(p.customer);
        if (p.tenders.length === 0) {
            // A payment with no tender recorded still moved money; naming the
            // method "Unrecorded" is what puts it in front of somebody, where
            // dropping it from the report would not.
            received.push({ date: iso(p.postDate), number: p.number ?? "", party, method: "Unrecorded", reference: null, amount: round2(num(p.amount) * sign) });
            continue;
        }
        for (const t of p.tenders) {
            received.push({
                date: iso(p.postDate), number: p.number ?? "", party,
                method: t.method?.name ?? "Unrecorded", reference: t.reference,
                amount: round2(num(t.amount) * sign),
            });
        }
    }

    const paid: CashRow[] = supplierPayments.map((p) => ({
        date: iso(p.postDate), number: p.number ?? "",
        party: [...new Set(p.allocations.map((a) => a.invoice.supplier.companyName))].join(", ") || "Several suppliers",
        method: p.method?.name ?? "Unrecorded", reference: p.reference, amount: round2(num(p.amount)),
    }));

    return {
        received, paid,
        receivedBy: totalsByMethod(received), paidBy: totalsByMethod(paid),
        receivedTotal: round2(received.reduce((t, r) => t + r.amount, 0)),
        paidTotal: round2(paid.reduce((t, r) => t + r.amount, 0)),
    };
}
