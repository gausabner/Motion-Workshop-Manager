import type { TenantTx } from "@/lib/tenant-db";

/**
 * Removing a document that should never have existed.
 *
 * A workshop got two job cards carrying the same number when a booking was
 * converted twice, and had to void both by hand. Voiding leaves them in every
 * list for ever, which is the right answer for a real document that went wrong
 * and the wrong answer for one that was never a document at all.
 *
 * Two rules make this safe enough to offer.
 *
 * **What it may touch.** Only a draft or a voided document, and only one that
 * nothing else depends on. A document with a payment against it, stock moved
 * for it, an inspection, a courtesy car, or a line on a supplier invoice is not
 * a stray duplicate — it is part of the books, and deleting it would orphan
 * records that answer for money. Those are refused by name rather than
 * silently, so the person knows which thing to unpick.
 *
 * **What survives it.** The document is written into the audit trail in full —
 * number, customer, vehicle, totals, every line — before the row goes. If a
 * deletion is ever dishonest, "who deleted it" is only half an answer; the
 * other half is what was on it. A trail that records the act but not the
 * content cannot settle anything.
 */

export type Blocker = { what: string; count: number };

/** What still depends on this document, in words a service advisor can act on. */
export async function deletionBlockers(tx: TenantTx, documentId: string): Promise<Blocker[]> {
    const [allocations, movements, inspections, loans, orderLines, supplierLines, bookingRequests] = await Promise.all([
        tx.paymentAllocation.count({ where: { documentId } }),
        tx.stockMovement.count({ where: { documentId } }),
        tx.inspection.count({ where: { documentId } }),
        tx.loan.count({ where: { documentId } }),
        tx.purchaseOrderLine.count({ where: { documentId } }),
        tx.supplierInvoiceLine.count({ where: { documentId } }),
        tx.bookingRequest.count({ where: { documentId } }),
    ]);
    return [
        { what: "a payment against it", count: allocations },
        { what: "stock moved for it", count: movements },
        { what: "an inspection", count: inspections },
        { what: "a courtesy car", count: loans },
        { what: "a line on a purchase order", count: orderLines },
        { what: "a line on a supplier invoice", count: supplierLines },
        { what: "an online booking request", count: bookingRequests },
    ].filter((b) => b.count > 0);
}

/** Everything worth keeping about a document once the row itself is gone. */
export async function snapshotDocument(tx: TenantTx, documentId: string) {
    return tx.document.findUnique({
        where: { id: documentId },
        select: {
            id: true, type: true, state: true, number: true, jobNumber: true,
            postDate: true, scheduledAt: true, description: true, reference: true,
            subtotal: true, taxName: true, taxRate: true, discountApplied: true, freight: true,
            total: true, jobStatus: true,
            customer: { select: { firstName: true, lastName: true } },
            vehicle: { select: { plate: true, make: true, model: true } },
            lines: {
                orderBy: { sortOrder: "asc" },
                select: { description: true, quantity: true, unitPrice: true, lineTotal: true, lineType: true },
            },
        },
    });
}

export class NotDeletable extends Error {}

export async function deleteDocument(
    tx: TenantTx,
    documentId: string,
    reason: string,
): Promise<{ snapshot: unknown; number: string }> {
    const doc = await tx.document.findUnique({
        where: { id: documentId },
        select: { id: true, state: true, number: true, jobNumber: true },
    });
    if (!doc) throw new NotDeletable("That document is already gone.");

    if (doc.state !== "DRAFT" && doc.state !== "VOID") {
        throw new NotDeletable(
            "Only a draft or a voided document can be deleted. Void this one first — that keeps what it was, and why.",
        );
    }

    const blockers = await deletionBlockers(tx, documentId);
    if (blockers.length > 0) {
        throw new NotDeletable(
            `This has ${blockers.map((b) => b.what).join(", ")} attached, so it is part of the books rather than a stray duplicate. Void it instead.`,
        );
    }

    // Read the whole thing before it stops existing.
    const snapshot = await snapshotDocument(tx, documentId);

    // Logs about the document outlive it, so they are unhooked rather than
    // destroyed: what was said to a customer is a record in its own right.
    await tx.message.updateMany({ where: { documentId }, data: { documentId: null } });
    await tx.reminder.updateMany({ where: { documentId }, data: { documentId: null } });

    // Lines, status events and time entries cascade with the row.
    await tx.document.delete({ where: { id: documentId } });

    return { snapshot: { ...snapshot, deletedBecause: reason }, number: doc.number ?? doc.jobNumber ?? doc.id };
}
