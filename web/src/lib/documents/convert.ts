import type { DocumentType } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";

/**
 * One conversion per source document, enforced where it can actually be
 * enforced.
 *
 * Reported from a live workshop on 23 September: a job card "became
 * duplicates" while it was being saved and worked on, with the owner and a
 * mechanic both in the system. `convertDocument` clones a source into a new
 * document and had nothing stopping that running twice. The result is
 * especially confusing because the clone carries the *source's* job number
 * rather than allocating a new one — so it does not look like two job cards,
 * it looks like one job card that duplicated itself.
 *
 * Two ways in. A double tap, which got easier when the 300ms tap delay was
 * removed for the phone work; and two people converting the same booking at
 * the same moment, which is what was happening here.
 *
 * A plain "does one already exist?" check closes the first and not the second:
 * two transactions both look, both see nothing, both insert. Locking the
 * source row first is what makes the check true — the second caller waits for
 * the first to commit, then sees the conversion it made and returns that
 * instead of making another. The same pattern the inspections and team
 * services already use for the same reason.
 *
 * A unique index would be stronger still, and it is the right long-term
 * answer, but it cannot be added yet: documents already exist that violate it,
 * including a pair sharing a job number, and which of a workshop's records to
 * remove is not a decision this migration gets to make.
 *
 * Voided conversions do not count. Voiding is how this workshop cleaned up the
 * duplicates, and having done so they must be able to convert again.
 */
export async function existingConversion(
    tx: TenantTx,
    sourceId: string,
    toType: DocumentType,
): Promise<string | null> {
    // Serialises concurrent conversions of the same source. Everything below
    // this line runs one caller at a time, per source document.
    await tx.$queryRaw`SELECT id FROM "Document" WHERE id = ${sourceId} FOR UPDATE`;

    const already = await tx.document.findFirst({
        where: { sourceDocumentId: sourceId, type: toType, state: { not: "VOID" } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
    });
    return already?.id ?? null;
}
