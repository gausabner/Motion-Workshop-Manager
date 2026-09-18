import "server-only";
import type { TenantTx } from "@/lib/tenant-db";
import { calculateTotals } from "@/lib/documents/totals";

/*
 * Kept out of the "use server" actions file on purpose: anything exported
 * from there becomes a server action a browser can call with any document id.
 */

/**
 * Recompute and store totals from the lines currently on the document.
 *
 * Tax settings come from the document's own snapshot, never from the tenant:
 * a workshop changing its VAT rate must not rewrite history.
 */
export async function recalculate(tx: TenantTx, documentId: string) {
    const doc = await tx.document.findUniqueOrThrow({
        where: { id: documentId },
        select: {
            taxRate: true, pricesIncludeTax: true, discountPercent: true, discountAmount: true, freight: true,
            lines: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, unitCost: true, vatRate: true, discountPercent: true } },
        },
    });
    const totals = calculateTotals({
        pricesIncludeTax: doc.pricesIncludeTax,
        freightVatRate: doc.taxRate.toNumber(),
        discountPercent: doc.discountPercent?.toNumber() ?? null,
        discountAmount: doc.discountAmount.toNumber(),
        freight: doc.freight.toNumber(),
        lines: doc.lines.map((l) => ({
            quantity: l.quantity.toNumber(),
            unitPrice: l.unitPrice.toNumber(),
            unitCost: l.unitCost.toNumber(),
            vatRate: l.vatRate.toNumber(),
            discountPercent: l.discountPercent.toNumber(),
        })),
    });
    await tx.document.update({
        where: { id: documentId },
        data: {
            subtotal: totals.subtotal, discountApplied: totals.discountApplied, vatTotal: totals.vatTotal,
            unroundedTotal: totals.total, rounding: 0, total: totals.total,
            // The benchmark's trick: the first line names the job, so lists,
            // statements and messages can say "Cambelt and water pump" instead
            // of "INV-1003". Nothing types it; it follows line one.
            // Only when there is a line one: a booking made from a service has its
            // description before it has any lines, and must not lose it on save.
            description: doc.lines[0] ? doc.lines[0].description.slice(0, 120) : undefined,
        },
    });
    // The per-line figures are stored too, so margin and sales reporting can sum
    // them in SQL. Nothing customer-facing reads them — a printed invoice derives
    // its own — but a column that exists must not be allowed to lie.
    for (const [index, line] of doc.lines.entries()) {
        const computed = totals.lines[index];
        if (!computed) continue;
        await tx.documentLine.update({
            where: { id: line.id },
            data: { lineSubtotal: computed.lineSubtotal, vatAmount: computed.vatAmount, lineTotal: computed.lineTotal },
        });
    }
    return totals;
}
