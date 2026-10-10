import "server-only";

import type { Prisma, SubscriptionCreditNote } from "@prisma/client";
import { issueCreditNote } from "@/lib/billing/invoices";

/**
 * Undoing a payment that was recorded in error.
 *
 * Three things, together or not at all: the payment is marked reversed (not
 * deleted — that it was recorded and undone is part of the record), the
 * workshop's paid-up-to date goes back to where that payment started, and its
 * tax invoice is cancelled by a credit note.
 *
 * Only the most recent payment can be reversed, and only while the date is
 * still the one it set. That keeps the dates honest: undoing payments newest
 * first walks the date back exactly the way it came, where undoing one from
 * the middle would leave a hole nobody could explain. If staff have moved the
 * date by hand since, the reversal is refused — the date is no longer that
 * payment's to give back.
 */

export type ReversalResult =
    | { ok: false; message: string }
    | { ok: true; creditNote: SubscriptionCreditNote | null; invoiceNumber: string | null; paidUntil: Date };

export async function reversePayment(
    tx: Prisma.TransactionClient,
    input: { tenantId: string; paymentId: string; staffId: string; reason: string; now: Date },
): Promise<ReversalResult> {
    const reason = input.reason.trim();
    if (reason.length < 5) return { ok: false, message: "Enter the reason for the reversal. It is printed on the credit note." };
    if (reason.length > 300) return { ok: false, message: "Keep the reason to 300 characters — it is printed on the credit note." };

    const sub = await tx.subscription.findUnique({ where: { tenantId: input.tenantId }, select: { id: true } });
    if (!sub) return { ok: false, message: "This workshop has no subscription." };
    await tx.$executeRaw`SELECT 1 FROM "Subscription" WHERE "id" = ${sub.id} FOR UPDATE`;
    const { periodEndsAt } = await tx.subscription.findUniqueOrThrow({ where: { id: sub.id }, select: { periodEndsAt: true } });

    const payment = await tx.subscriptionPayment.findFirst({
        where: { id: input.paymentId, tenantId: input.tenantId },
        select: { id: true, periodFrom: true, periodTo: true, reversedAt: true, invoice: { select: { id: true, number: true } } },
    });
    if (!payment) return { ok: false, message: "That payment is not this workshop's." };
    if (payment.reversedAt) return { ok: false, message: "That payment has already been reversed." };

    const latest = await tx.subscriptionPayment.findFirst({
        where: { tenantId: input.tenantId, reversedAt: null },
        orderBy: [{ periodTo: "desc" }, { confirmedAt: "desc" }],
        select: { id: true, invoice: { select: { number: true } } },
    });
    if (latest && latest.id !== payment.id) {
        return { ok: false, message: `Payments are reversed newest first. Reverse ${latest.invoice?.number ?? "the most recent payment"} first.` };
    }
    if (!periodEndsAt || periodEndsAt.getTime() !== payment.periodTo.getTime()) {
        return {
            ok: false,
            message: "The paid-up-to date has been changed by hand since this payment was recorded, so it cannot be walked back automatically. Use Change date instead.",
        };
    }

    await tx.subscription.update({
        where: { id: sub.id },
        // The reminders were for a date that no longer stands; whatever is
        // due from the restored date is the morning run's to decide.
        data: { periodEndsAt: payment.periodFrom, remindedFor: null, overdueNoticeFor: null },
    });
    await tx.subscriptionPayment.update({ where: { id: payment.id }, data: { reversedAt: input.now } });
    const creditNote = payment.invoice ? await issueCreditNote(tx, payment.invoice.id, { reason, issuedById: input.staffId, issuedAt: input.now }) : null;

    return { ok: true, creditNote, invoiceNumber: payment.invoice?.number ?? null, paidUntil: payment.periodFrom };
}
