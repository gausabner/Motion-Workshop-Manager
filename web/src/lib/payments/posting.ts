import "server-only";
import type { TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { clampAllocation, paymentPostingError, stateAfterAllocation } from "@/lib/documents/settlement";
import { amountDue, round2 } from "@/lib/documents/totals";

/**
 * The money rules for posting and reversing a receipt, kept apart from the
 * server actions that wrap them in auth, revalidation and redirects.
 *
 * Everything here runs inside one interactive transaction and re-reads what it
 * depends on, so two people settling the same invoice at the same moment
 * cannot both succeed. Keeping it out of the "use server" module is also what
 * makes it runnable against a real database in a check.
 */

const PROCESSED = { where: { payment: { state: "PROCESSED" as const } }, select: { amount: true } };

function sum(rows: { amount: { toNumber(): number } }[]): number {
    return round2(rows.reduce((total, r) => total + r.amount.toNumber(), 0));
}

/** Post a draft receipt: settle what it is pointed at, then give it its number. */
export async function postPayment(tx: TenantTx, tenantId: string, membershipId: string, paymentId: string): Promise<{ number: string; amount: number }> {
    const payment = await tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: { id: true, state: true, customerId: true, tenders: { select: { amount: true } }, allocations: { select: { documentId: true, amount: true } } },
    });
    if (payment.state !== "DRAFT") throw new Error("Only a draft receipt can be posted");
    if (!payment.customerId) throw new Error("Choose a customer before posting this receipt");

    const tendered = payment.tenders.map((t) => t.amount.toNumber());
    const problem = paymentPostingError(tendered, payment.allocations.map((a) => a.amount.toNumber()));
    if (problem) throw new Error(problem);

    for (const allocation of payment.allocations) {
        const doc = await tx.document.findUniqueOrThrow({
            where: { id: allocation.documentId },
            select: { id: true, type: true, state: true, number: true, total: true, customerId: true, allocations: PROCESSED },
        });
        const name = doc.number ?? "That document";
        if (doc.customerId !== payment.customerId) throw new Error(`${name} belongs to another customer`);
        if (doc.state !== "PROCESSED") throw new Error(`${name} is no longer open`);

        const total = doc.total.toNumber();
        const already = sum(doc.allocations);
        const outstanding = amountDue(total, already);
        const amount = allocation.amount.toNumber();
        if (clampAllocation(outstanding, amount) !== amount) {
            throw new Error(`${name} has ${outstanding.toFixed(2)} outstanding — ${amount.toFixed(2)} cannot be applied to it`);
        }
        await tx.document.update({ where: { id: doc.id }, data: { state: stateAfterAllocation(doc.state, doc.type, total, round2(already + amount)) } });
    }

    const number = await allocateNumber(tx, tenantId, "RECEIPT");
    const amount = round2(tendered.reduce((total, t) => total + t, 0));
    await tx.payment.update({ where: { id: paymentId }, data: { state: "PROCESSED", number, processedAt: new Date(), takenById: membershipId, amount } });
    return { number, amount };
}

/**
 * Reverse a posted receipt. The allocations stay for the audit trail but stop
 * counting, so every document it touched is re-derived and may re-open.
 */
export async function reversePayment(tx: TenantTx, paymentId: string, reason: string): Promise<void> {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { state: true, allocations: { select: { documentId: true } } } });
    if (payment.state === "VOID") throw new Error("Already voided");

    await tx.payment.update({ where: { id: paymentId }, data: { state: "VOID", voidedAt: new Date(), voidReason: reason } });

    for (const { documentId } of payment.allocations) {
        const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId }, select: { id: true, type: true, state: true, total: true, allocations: PROCESSED } });
        await tx.document.update({ where: { id: doc.id }, data: { state: stateAfterAllocation(doc.state, doc.type, doc.total.toNumber(), sum(doc.allocations)) } });
    }
}
