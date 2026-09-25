import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { round2 } from "@/lib/documents/totals";

/**
 * What is owed to the receiver for a period.
 *
 * Output tax on what was sold, input tax on what was bought, and the
 * difference. A workshop's accountant works this out from the register by
 * hand every two months; a council's finance office expects the system to
 * produce it.
 *
 * The figures are trustworthy for one specific reason: the tax name and rate
 * are frozen onto each document at the moment it is raised, and never read
 * back from the workshop's settings. When the rate changes — and in Namibia it
 * has — last year's return does not silently rewrite itself. This report
 * groups by the rate that was actually charged, so a period spanning a change
 * shows both bands rather than averaging them into a figure that matches
 * nothing.
 *
 * Internal jobs are excluded from output tax. Work a workshop does on its own
 * vehicle is not a sale, and counting it would overstate what is owed.
 */

export type TaxBand = {
    name: string;
    rate: number;
    documents: number;
    net: number;
    tax: number;
};

export type VatSummary = {
    output: TaxBand[];
    input: TaxBand[];
    outputTax: number;
    inputTax: number;
    /** Positive: owed to the receiver. Negative: refundable. */
    payable: number;
    excludedInternal: number;
};

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);

function band(rows: { taxName: string; taxRate: Prisma.Decimal; net: number; tax: number }[]): TaxBand[] {
    const map = new Map<string, TaxBand>();
    for (const r of rows) {
        const rate = num(r.taxRate);
        const key = `${r.taxName}@${rate}`;
        const existing = map.get(key) ?? { name: r.taxName, rate, documents: 0, net: 0, tax: 0 };
        existing.documents += 1;
        existing.net = round2(existing.net + r.net);
        existing.tax = round2(existing.tax + r.tax);
        map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name));
}

export async function vatSummary(db: TenantDb, from: Date, to: Date): Promise<VatSummary> {
    const [sales, purchases] = await Promise.all([
        db.document.findMany({
            where: { type: { in: ["INVOICE", "CASH_SALE", "CREDIT"] }, state: { in: ["PROCESSED", "CLOSED"] }, postDate: { gte: from, lte: to } },
            select: { type: true, taxName: true, taxRate: true, subtotal: true, vatTotal: true, isInternal: true },
        }),
        db.supplierInvoice.findMany({
            where: { state: { in: ["PROCESSED", "CLOSED"] }, postDate: { gte: from, lte: to } },
            select: { taxName: true, taxRate: true, subtotal: true, taxTotal: true },
        }),
    ]);

    const chargeable = sales.filter((s) => !s.isInternal);
    const output = band(
        chargeable.map((s) => {
            // Credits are stored negative; the sign is applied once, here, so a
            // credit reduces the band it belongs to rather than forming its own.
            const sign = s.type === "CREDIT" ? -1 : 1;
            return { taxName: s.taxName, taxRate: s.taxRate, net: round2(Math.abs(num(s.subtotal)) * sign), tax: round2(Math.abs(num(s.vatTotal)) * sign) };
        }),
    );
    const input = band(purchases.map((p) => ({ taxName: p.taxName, taxRate: p.taxRate, net: num(p.subtotal), tax: num(p.taxTotal) })));

    const outputTax = round2(output.reduce((t, b) => t + b.tax, 0));
    const inputTax = round2(input.reduce((t, b) => t + b.tax, 0));

    return { output, input, outputTax, inputTax, payable: round2(outputTax - inputTax), excludedInternal: sales.length - chargeable.length };
}
