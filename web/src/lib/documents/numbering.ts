import "server-only";
import type { SequenceKey } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";

/**
 * Allocate the next number for a tenant sequence (PRD DOC-11).
 *
 * The atomic `update … next: { increment: 1 }` is what stops two counter staff
 * processing invoices at the same moment from getting the same number: the row
 * lock is held for the increment, and each caller reads back its own value.
 * Call inside the same transaction as the document write so a failed process
 * does not burn a number.
 */
export async function allocateNumber(tx: TenantTx, tenantId: string, key: SequenceKey): Promise<string> {
    const seq = await tx.sequence.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, prefix: defaultPrefix(key), next: 1002 },
        update: { next: { increment: 1 } },
        select: { prefix: true, next: true },
    });
    // `next` is the value *after* the increment, so the number just allocated is one below.
    const allocated = seq.next - 1;
    return `${seq.prefix}${allocated}`;
}

function defaultPrefix(key: SequenceKey): string {
    switch (key) {
        case "QUOTE": return "Q-";
        case "JOB": return "JC-";
        case "INVOICE": return "INV-";
        case "CREDIT": return "CR-";
        case "RECEIPT": return "RC-";
        case "REFUND": return "RF-";
        case "INSPECTION": return "IN-";
        case "PURCHASE_ORDER": return "PO-";
        case "SUPPLIER_PAYMENT": return "SP-";
    }
}
