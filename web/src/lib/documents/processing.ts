import "server-only";
import type { DocumentType, Tenant } from "@prisma/client";
import type { TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { stateOnProcess } from "@/lib/documents/settlement";
import { TYPE_SEQUENCE } from "@/lib/documents/types";
import { recalculate } from "@/lib/documents/recalculate";
import type { PromptInput, PromptKind } from "@/lib/documents/process-prompt";
import { postDocumentStock, type StockWarning } from "@/lib/stock/ledger";
import { postDocumentSerials, type SerialProblem } from "@/lib/products/serial-service";

/**
 * Posting a document, inside one transaction: number it, lock it, and move the
 * vehicle's record on as far as the document type warrants. Plain module, so
 * it runs against a real database in a check — the server action is the
 * auth, validation and redirect around it.
 */

const FINANCIAL = new Set<DocumentType>(["INVOICE", "CASH_SALE", "CREDIT"]);
const JOB_LIKE = new Set<DocumentType>(["BOOKING", "JOB_CARD"]);

type Doc = { id: string; type: DocumentType; vehicleId: string | null; postDate: Date; dueDate: Date | null; paymentTermsDays: number | null };

const asDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`) : null);

export async function postDocument(
    tx: TenantTx,
    tenant: Tenant,
    who: { membershipId: string; userId: string },
    doc: Doc,
    kind: PromptKind,
    answers: PromptInput,
): Promise<{ number: string; total: number; stockWarnings: StockWarning[]; serialProblems: SerialProblem[] }> {
    // The answers belong to the document as well as the car: a reprinted invoice shows the reading it was billed at.
    if (kind !== "none") {
        await tx.document.update({
            where: { id: doc.id },
            data: {
                ...(answers.odometer !== null ? { odometer: answers.odometer } : {}),
                ...(kind === "service" ? { nextServiceKm: answers.nextServiceKm, nextServiceDate: asDate(answers.nextServiceDate) } : {}),
            },
        });
    }

    // The same recalculation every save runs, so what is posted is what was on screen.
    const totals = await recalculate(tx, doc.id);
    const number = await allocateNumber(tx, tenant.id, TYPE_SEQUENCE[doc.type]);
    const terms = doc.paymentTermsDays ?? tenant.defaultPaymentTermsDays;
    const dueDate = doc.dueDate ?? new Date(doc.postDate.getTime() + terms * 86_400_000);

    await tx.document.update({
        where: { id: doc.id },
        data: {
            number,
            state: stateOnProcess(doc.type, totals.total),
            processedAt: new Date(),
            processedById: who.membershipId,
            dueDate: FINANCIAL.has(doc.type) ? dueDate : null,
            jobStatus: JOB_LIKE.has(doc.type) ? undefined : null,
        },
    });

    if (doc.vehicleId && kind === "service") {
        await tx.vehicle.update({
            where: { id: doc.vehicleId },
            data: {
                odometer: answers.odometer ?? undefined,
                lastInDate: doc.postDate,
                lastServiceDate: doc.postDate,
                nextServiceKm: answers.nextServiceKm ?? undefined,
                nextServiceDate: asDate(answers.nextServiceDate) ?? undefined,
                // Renewal dates only move when someone gives one; a blank is not "no licence disc".
                licenceExpiry: asDate(answers.licenceExpiry) ?? undefined,
                roadworthyExpiry: asDate(answers.roadworthyExpiry) ?? undefined,
            },
        });
    } else if (doc.vehicleId && kind === "arrival") {
        await tx.vehicle.update({ where: { id: doc.vehicleId }, data: { odometer: answers.odometer ?? undefined, lastInDate: doc.postDate } });
    }

    // Stock leaves the shelf when the sale is posted, not when the line is typed.
    const stockWarnings = await postDocumentStock(tx, tenant.id, { id: doc.id, type: doc.type, postDate: doc.postDate }, who.membershipId);
    // Serialised units leave with the sale and come back on a credit note.
    const serialProblems = await postDocumentSerials(tx, tenant.id, { id: doc.id, type: doc.type, postDate: doc.postDate });

    await tx.auditEvent.create({
        data: { tenantId: tenant.id, actorUserId: who.userId, entityType: "Document", entityId: doc.id, action: "PROCESSED", diff: { number, total: totals.total, prompt: kind, ...(kind !== "none" ? { answers } : {}) } },
    });
    return { number, total: totals.total, stockWarnings, serialProblems };
}
