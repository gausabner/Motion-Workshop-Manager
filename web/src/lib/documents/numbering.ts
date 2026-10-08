import "server-only";
import type { SequenceKey } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { defaultPrefix, FIRST_NUMBER } from "@/lib/documents/numbering-rules";

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
        create: { tenantId, key, prefix: defaultPrefix(key), next: FIRST_NUMBER + 1 },
        update: { next: { increment: 1 } },
        select: { prefix: true, next: true },
    });
    // `next` is the value *after* the increment, so the number just allocated is one below.
    const allocated = seq.next - 1;
    return `${seq.prefix}${allocated}`;
}
