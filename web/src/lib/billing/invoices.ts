import "server-only";

import type { BillingPeriod, Prisma, SubscriptionInvoice } from "@prisma/client";
import { LEGAL_ENTITY } from "@/lib/legal/documents";
import { support } from "@/lib/edition";
import { VAT_RATE } from "@/lib/pricing/plans";

/**
 * Tax invoices for MOTION's own billing: one per confirmed payment.
 *
 * Issued inside the same staff transaction that records the payment, so there
 * is never a confirmed payment without its invoice or an invoice without its
 * payment. Everything printed is copied onto the row here — see the schema —
 * and the renderer reads nothing else.
 */

export type InvoiceParty = {
    name: string;
    tradingAs: string | null;
    addressLines: string[];
    vatNumber: string | null;
    registrationNumber: string | null;
    email: string | null;
};

/**
 * The prefix in front of the serial. Configurable so it can be settled before
 * the first real invoice goes out; after that, changing it starts a visibly
 * different series, which an accountant would ask about.
 */
export function invoicePrefix(): string {
    return process.env.BILLING_INVOICE_PREFIX?.trim() || "MWM-";
}

export function formatInvoiceNumber(serial: number, prefix = invoicePrefix()): string {
    return `${prefix}${String(serial).padStart(5, "0")}`;
}

/** Who the invoice is from: the registered person, which is who must be named on a tax invoice. */
export function supplierParty(): InvoiceParty {
    return {
        name: LEGAL_ENTITY.name,
        tradingAs: LEGAL_ENTITY.tradingAs,
        addressLines: [LEGAL_ENTITY.address, LEGAL_ENTITY.postalAddress].filter((line): line is string => Boolean(line)),
        vatNumber: LEGAL_ENTITY.vatNumber,
        registrationNumber: LEGAL_ENTITY.registrationNumber,
        email: support().email,
    };
}

const COUNTRY: Record<string, string> = { NA: "Namibia", ZA: "South Africa" };

type RecipientSource = {
    name: string;
    vatNumber: string | null;
    registrationNumber: string | null;
    address1: string | null;
    address2: string | null;
    suburb: string | null;
    city: string | null;
    region: string | null;
    postcode: string | null;
    country: string;
    email: string | null;
};

/** The workshop, from its company profile — the same lines its own documents carry. */
export function recipientParty(t: RecipientSource, ownerEmail: string | null): InvoiceParty {
    return {
        name: t.name,
        tradingAs: null,
        addressLines: [
            [t.address1, t.address2].filter(Boolean).join(", "),
            [t.suburb, t.city].filter(Boolean).join(", "),
            [t.region, t.postcode].filter(Boolean).join(" "),
            COUNTRY[t.country] ?? t.country,
        ].filter((line) => line.trim().length > 0),
        vatNumber: t.vatNumber?.trim() || null,
        registrationNumber: t.registrationNumber?.trim() || null,
        email: t.email ?? ownerEmail,
    };
}

/** What a workshop needs on file for its invoices to be complete. Shown on its Billing page. */
export function recipientGaps(t: Pick<RecipientSource, "address1" | "city" | "vatNumber">): string[] {
    const gaps: string[] = [];
    if (!t.address1?.trim() || !t.city?.trim()) gaps.push("address");
    if (!t.vatNumber?.trim()) gaps.push("VAT number");
    return gaps;
}

/** Reads a party back off an issued invoice. Tolerant, because a printed record must always print. */
export function asParty(value: Prisma.JsonValue): InvoiceParty {
    const v = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
    const text = (x: unknown) => (typeof x === "string" && x.trim() ? x : null);
    return {
        name: text(v.name) ?? "—",
        tradingAs: text(v.tradingAs),
        addressLines: Array.isArray(v.addressLines) ? v.addressLines.filter((l): l is string => typeof l === "string") : [],
        vatNumber: text(v.vatNumber),
        registrationNumber: text(v.registrationNumber),
        email: text(v.email),
    };
}

const PERIOD_WORD: Record<BillingPeriod, string> = { MONTHLY: "monthly", QUARTERLY: "quarterly", ANNUAL: "annual" };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Issue the tax invoice for a payment, or return the one already issued.
 *
 * Must run inside a staff transaction. Serials are handed out one at a time
 * across all of MOTION under a transaction-scoped lock: two payments recorded
 * at the same moment get consecutive numbers rather than the same one, and a
 * transaction that rolls back gives its number back instead of leaving a gap.
 * A gap in a run of tax invoices is the first thing an auditor asks about.
 */
export async function issueInvoice(tx: Prisma.TransactionClient, paymentId: string, issuedAt = new Date()): Promise<SubscriptionInvoice> {
    const existing = await tx.subscriptionInvoice.findUnique({ where: { paymentId } });
    if (existing) return existing;

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"motion.subscription_invoice"}))`;
    // Somebody may have issued it while this waited for the lock.
    const raced = await tx.subscriptionInvoice.findUnique({ where: { paymentId } });
    if (raced) return raced;

    const payment = await tx.subscriptionPayment.findUniqueOrThrow({
        where: { id: paymentId },
        select: {
            tenantId: true,
            amountExclVat: true,
            amountInclVat: true,
            periodFrom: true,
            periodTo: true,
            confirmedAt: true,
            subscription: { select: { planName: true, period: true, reference: true, currency: true } },
            tenant: {
                select: {
                    name: true,
                    vatNumber: true,
                    registrationNumber: true,
                    address1: true,
                    address2: true,
                    suburb: true,
                    city: true,
                    region: true,
                    postcode: true,
                    country: true,
                    email: true,
                    memberships: {
                        where: { group: "OWNER" },
                        orderBy: { createdAt: "asc" },
                        take: 1,
                        select: { user: { select: { email: true } } },
                    },
                },
            },
        },
    });

    const { _max } = await tx.subscriptionInvoice.aggregate({ _max: { serial: true } });
    const serial = (_max.serial ?? 0) + 1;
    const excl = round2(Number(payment.amountExclVat));
    const incl = round2(Number(payment.amountInclVat));
    const sub = payment.subscription;

    return tx.subscriptionInvoice.create({
        data: {
            tenantId: payment.tenantId,
            paymentId,
            serial,
            number: formatInvoiceNumber(serial),
            issuedAt,
            supplier: supplierParty(),
            recipient: recipientParty(payment.tenant, payment.tenant.memberships[0]?.user.email ?? null),
            description: `MOTION Workshop Manager — ${sub.planName} plan, ${PERIOD_WORD[sub.period]} subscription`,
            periodFrom: payment.periodFrom,
            periodTo: payment.periodTo,
            amountExclVat: excl,
            vatRate: VAT_RATE,
            vatAmount: round2(incl - excl),
            amountInclVat: incl,
            currency: sub.currency,
            paymentReference: sub.reference,
            paidAt: payment.confirmedAt,
        },
    });
}
