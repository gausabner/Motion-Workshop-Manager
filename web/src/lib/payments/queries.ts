import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { PROCESSED_ALLOCATIONS } from "@/lib/documents/queries";
import { amountDue, round2 } from "@/lib/documents/totals";
import { ageingBucket, ageItems, AGEING_BUCKETS, emptyAgeing, type Ageing, type OpenItem } from "@/lib/payments/allocation";

/** Document types that sit on a customer's account and can therefore be settled. */
const ACCOUNT_TYPES = ["INVOICE", "CASH_SALE", "CREDIT"] as const;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function sumAmounts(rows: { amount: { toNumber(): number } }[]): number {
    return round2(rows.reduce((sum, r) => sum + r.amount.toNumber(), 0));
}

export async function getPaymentMethods(db: TenantDb) {
    const rows = await db.paymentMethod.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, code: true, isEft: true } });
    return rows;
}

export type PaymentMethodOption = Awaited<ReturnType<typeof getPaymentMethods>>[number];

/**
 * Everything on this customer's account that still has money against it.
 *
 * A settled document is CLOSED, so PROCESSED is exactly the open set — the
 * outstanding is still derived from the allocations rather than read off the
 * document, because that is the number we refuse to store.
 */
export async function getOpenItems(db: TenantDb, customerId: string): Promise<OpenItem[]> {
    const rows = await db.document.findMany({
        where: { customerId, state: "PROCESSED", type: { in: [...ACCOUNT_TYPES] } },
        orderBy: [{ postDate: "asc" }, { createdAt: "asc" }],
        select: {
            id: true, type: true, number: true, postDate: true, dueDate: true, reference: true, total: true,
            allocations: PROCESSED_ALLOCATIONS,
        },
    });
    return rows
        .map((r) => {
            const total = r.total.toNumber();
            return {
                id: r.id,
                type: r.type,
                number: r.number,
                postDate: isoDate(r.postDate),
                dueDate: r.dueDate ? isoDate(r.dueDate) : null,
                reference: r.reference,
                total,
                outstanding: amountDue(total, sumAmounts(r.allocations)),
            };
        })
        .filter((r) => r.outstanding !== 0);
}

/**
 * The account summary shown in a customer's header and at the top of a receipt.
 *
 * `balance` is what the open documents say is owed; `unapplied` is money already
 * taken but not yet pointed at anything. The benchmark leaves the second one
 * hard to derive, which is why we surface both and the net.
 */
export async function getCustomerAccount(db: TenantDb, customerId: string, asAt: Date = new Date()) {
    const [openItems, payments] = await Promise.all([
        getOpenItems(db, customerId),
        db.payment.findMany({ where: { customerId, state: "PROCESSED" }, select: { amount: true, allocations: { select: { amount: true } } } }),
    ]);
    // Netted, not floored per payment: a refund carries negative tenders, and
    // paying money back out is exactly what should reduce what sits on account.
    const unapplied = round2(payments.reduce((sum, p) => sum + p.amount.toNumber() - sumAmounts(p.allocations), 0));
    const ageing = ageItems(openItems, asAt);
    return { openItems, ageing, balance: ageing.total, unapplied, netOwing: round2(ageing.total - unapplied) };
}

export type CustomerAccount = Awaited<ReturnType<typeof getCustomerAccount>>;

export type PaymentListParams = {
    q?: string;
    state?: "DRAFT" | "PROCESSED" | "VOID";
    direction?: "RECEIPT" | "REFUND";
    customerId?: string;
    unappliedOnly?: boolean;
    page?: number;
    size?: number;
};

export async function listPayments(db: TenantDb, p: PaymentListParams) {
    const size = Math.min(Math.max(p.size ?? 25, 10), 100);
    const page = Math.max(p.page ?? 1, 1);
    const where: Prisma.PaymentWhereInput = {
        ...(p.state ? { state: p.state } : {}),
        ...(p.direction ? { direction: p.direction } : {}),
        ...(p.customerId ? { customerId: p.customerId } : {}),
        ...(p.q
            ? {
                  OR: [
                      { number: { contains: p.q, mode: "insensitive" } },
                      { note: { contains: p.q, mode: "insensitive" } },
                      { tenders: { some: { reference: { contains: p.q, mode: "insensitive" } } } },
                      { customer: { OR: [{ firstName: { contains: p.q, mode: "insensitive" } }, { lastName: { contains: p.q, mode: "insensitive" } }] } },
                  ],
              }
            : {}),
    };

    // "Unapplied" is `amount > sum(allocations)`, which no index can answer, so it
    // is filtered after the fact and paged in memory. Bounded by posted receipts,
    // which is a few thousand a year for a workshop — revisit if that stops holding.
    const scanning = !!p.unappliedOnly;
    const [rows, total] = await Promise.all([
        db.payment.findMany({
            where,
            orderBy: [{ postDate: "desc" }, { createdAt: "desc" }],
            ...(scanning ? { take: 5000 } : { skip: (page - 1) * size, take: size }),
            select: {
                id: true, number: true, state: true, direction: true, postDate: true, amount: true, note: true,
                customer: { select: { id: true, firstName: true, lastName: true } },
                tenders: { select: { amount: true, reference: true, method: { select: { name: true } } }, orderBy: { sortOrder: "asc" } },
                allocations: { select: { amount: true } },
            },
        }),
        scanning ? Promise.resolve(0) : db.payment.count({ where }),
    ]);

    const mapped = rows.map((r) => {
        const amount = r.amount.toNumber();
        const allocated = sumAmounts(r.allocations);
        return {
            id: r.id,
            number: r.number,
            state: r.state,
            direction: r.direction,
            postDate: r.postDate,
            note: r.note,
            customer: r.customer,
            amount,
            allocated,
            // Magnitude: money left on account for a receipt, money taken off it for a refund.
            unapplied: round2(Math.abs(amount - allocated)),
            methods: r.tenders.map((t) => ({ name: t.method.name, amount: t.amount.toNumber(), reference: t.reference })),
        };
    });

    const filtered = scanning ? mapped.filter((r) => r.unapplied > 0) : mapped;
    const count = scanning ? filtered.length : total;
    return {
        rows: scanning ? filtered.slice((page - 1) * size, page * size) : filtered,
        total: count,
        page,
        size,
        pages: Math.max(1, Math.ceil(count / size)),
    };
}

/** Cash through the counter on a given day — the number the owner asks for at closing. */
export async function takenOn(db: TenantDb, day: Date): Promise<number> {
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const end = new Date(start.getTime() + 86_400_000);
    const agg = await db.payment.aggregate({ where: { state: "PROCESSED", postDate: { gte: start, lt: end } }, _sum: { amount: true } });
    return round2(agg._sum.amount?.toNumber() ?? 0);
}

export async function getPayment(db: TenantDb, id: string) {
    const payment = await db.payment.findUnique({
        where: { id },
        select: {
            id: true, number: true, state: true, direction: true, postDate: true, amount: true, note: true, processedAt: true, voidedAt: true, voidReason: true,
            customer: { select: { id: true, firstName: true, lastName: true, mobile: true, email: true } },
            takenBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            tenders: {
                orderBy: { sortOrder: "asc" },
                select: { id: true, methodId: true, amount: true, tendered: true, reference: true, proofAttachmentId: true, method: { select: { name: true, isEft: true } } },
            },
            allocations: {
                select: {
                    documentId: true, amount: true,
                    document: { select: { id: true, type: true, number: true, postDate: true, dueDate: true, reference: true, total: true, state: true } },
                },
            },
        },
    });
    if (!payment) return null;
    // The proofs are looked up in one go rather than joined, because the tender
    // points at the attachment and not the other way round.
    const proofs = await db.attachment.findMany({
        where: { id: { in: payment.tenders.map((t) => t.proofAttachmentId).filter((v): v is string => !!v) } },
        select: { id: true, fileName: true, mimeType: true, size: true },
    });
    const proofById = new Map(proofs.map((a) => [a.id, a]));
    return {
        ...payment,
        amount: payment.amount.toNumber(),
        tenders: payment.tenders.map((t) => ({
            ...t,
            amount: t.amount.toNumber(),
            tendered: t.tendered?.toNumber() ?? null,
            proof: t.proofAttachmentId ? proofById.get(t.proofAttachmentId) ?? null : null,
        })),
        allocations: payment.allocations.map((a) => ({
            documentId: a.documentId,
            amount: a.amount.toNumber(),
            document: { ...a.document, postDate: isoDate(a.document.postDate), dueDate: a.document.dueDate ? isoDate(a.document.dueDate) : null, total: a.document.total.toNumber() },
        })),
    };
}

export type PaymentRecord = NonNullable<Awaited<ReturnType<typeof getPayment>>>;

/**
 * A customer statement: every account document in the window with its running
 * balance, plus the ageing that goes in the footer.
 */
export async function getStatement(db: TenantDb, customerId: string, from: Date, to: Date) {
    const [customer, docs, payments, account] = await Promise.all([
        db.customer.findUnique({ where: { id: customerId }, select: { id: true, firstName: true, lastName: true, email: true, mobile: true, postalAddress1: true, postalCity: true } }),
        db.document.findMany({
            where: { customerId, state: { in: ["PROCESSED", "CLOSED"] }, type: { in: [...ACCOUNT_TYPES] }, postDate: { gte: from, lte: to } },
            orderBy: [{ postDate: "asc" }, { createdAt: "asc" }],
            select: { id: true, type: true, number: true, postDate: true, dueDate: true, reference: true, total: true },
        }),
        db.payment.findMany({
            where: { customerId, state: "PROCESSED", postDate: { gte: from, lte: to } },
            orderBy: [{ postDate: "asc" }, { createdAt: "asc" }],
            select: { id: true, number: true, direction: true, postDate: true, amount: true },
        }),
        getCustomerAccount(db, customerId, to),
    ]);
    if (!customer) return null;

    // Everything before the window, netted, is the balance the statement opens on.
    const [priorDocs, priorPayments] = await Promise.all([
        db.document.aggregate({ where: { customerId, state: { in: ["PROCESSED", "CLOSED"] }, type: { in: [...ACCOUNT_TYPES] }, postDate: { lt: from } }, _sum: { total: true } }),
        db.payment.aggregate({ where: { customerId, state: "PROCESSED", postDate: { lt: from } }, _sum: { amount: true } }),
    ]);
    const opening = round2((priorDocs._sum.total?.toNumber() ?? 0) - (priorPayments._sum.amount?.toNumber() ?? 0));

    type Row = { id: string; kind: "DOCUMENT" | "PAYMENT"; label: string; number: string | null; postDate: string; reference: string | null; amount: number; balance: number };
    const merged: Omit<Row, "balance">[] = [
        ...docs.map((d) => ({ id: d.id, kind: "DOCUMENT" as const, label: d.type === "CREDIT" ? "Credit note" : d.type === "CASH_SALE" ? "Cash sale" : "Invoice", number: d.number, postDate: isoDate(d.postDate), reference: d.reference, amount: d.total.toNumber() })),
        ...payments.map((p) => ({ id: p.id, kind: "PAYMENT" as const, label: p.direction === "REFUND" ? "Refund" : "Receipt", number: p.number, postDate: isoDate(p.postDate), reference: null, amount: round2(-p.amount.toNumber()) })),
    ].sort((a, b) => a.postDate.localeCompare(b.postDate) || a.kind.localeCompare(b.kind));

    let running = opening;
    const rows: Row[] = merged.map((r) => {
        running = round2(running + r.amount);
        return { ...r, balance: running };
    });

    return { customer, from: isoDate(from), to: isoDate(to), opening, rows, closing: running, ageing: account.ageing, unapplied: account.unapplied };
}

export type Statement = NonNullable<Awaited<ReturnType<typeof getStatement>>>;

export type ReceivableRow = {
    customerId: string;
    name: string;
    mobile: string | null;
    email: string | null;
    oldestDue: string | null;
    ageing: Ageing;
};

/**
 * Aged debtors for the whole workshop — who owes what, and how long it has
 * been sitting there.
 *
 * One pass over the open documents, grouped in memory. Unapplied credit is
 * netted in per customer, because a debtor who has already paid money onto the
 * account is not a debtor for that part, and chasing them for it is the fastest
 * way to lose them.
 */
export async function listReceivables(db: TenantDb, asAt: Date = new Date()): Promise<{ rows: ReceivableRow[]; totals: Ageing; unapplied: number }> {
    const [docs, payments] = await Promise.all([
        db.document.findMany({
            where: { state: "PROCESSED", type: { in: [...ACCOUNT_TYPES] }, customerId: { not: null } },
            select: {
                customerId: true, postDate: true, dueDate: true, total: true,
                allocations: PROCESSED_ALLOCATIONS,
                customer: { select: { id: true, firstName: true, lastName: true, mobile: true, email: true } },
            },
        }),
        db.payment.findMany({ where: { state: "PROCESSED" }, select: { customerId: true, amount: true, allocations: { select: { amount: true } } } }),
    ]);

    const byCustomer = new Map<string, ReceivableRow>();
    for (const doc of docs) {
        if (!doc.customer) continue;
        const outstanding = amountDue(doc.total.toNumber(), sumAmounts(doc.allocations));
        if (outstanding === 0) continue;
        const row = byCustomer.get(doc.customer.id) ?? {
            customerId: doc.customer.id,
            name: `${doc.customer.firstName} ${doc.customer.lastName}`.trim(),
            mobile: doc.customer.mobile,
            email: doc.customer.email,
            oldestDue: null,
            ageing: emptyAgeing(),
        };
        const due = isoDate(doc.dueDate ?? doc.postDate);
        const bucket = ageingBucket(due, asAt);
        row.ageing[bucket] = round2(row.ageing[bucket] + outstanding);
        row.ageing.total = round2(row.ageing.total + outstanding);
        if (outstanding > 0 && (!row.oldestDue || due < row.oldestDue)) row.oldestDue = due;
        byCustomer.set(doc.customer.id, row);
    }

    let unapplied = 0;
    for (const payment of payments) {
        const left = round2(payment.amount.toNumber() - sumAmounts(payment.allocations));
        if (left === 0 || !payment.customerId) continue;
        unapplied = round2(unapplied + left);
        const row = byCustomer.get(payment.customerId);
        if (row) {
            row.ageing.current = round2(row.ageing.current - left);
            row.ageing.total = round2(row.ageing.total - left);
        }
    }

    const rows = [...byCustomer.values()].filter((r) => r.ageing.total !== 0).sort((a, b) => b.ageing.total - a.ageing.total);
    const totals = rows.reduce((acc, r) => {
        for (const bucket of AGEING_BUCKETS) acc[bucket] = round2(acc[bucket] + r.ageing[bucket]);
        acc.total = round2(acc.total + r.ageing.total);
        return acc;
    }, emptyAgeing());

    return { rows, totals, unapplied };
}
