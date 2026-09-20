import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { allocationError, parseSerials, warrantyUntil } from "@/lib/products/serials";

/**
 * Serialised units against the database. Units are booked in when goods
 * arrive, allocated when the sale is posted, and returned when it is undone —
 * the same three moments the stock ledger cares about, so the two never
 * disagree about what is on the shelf.
 */

const num = (d: Prisma.Decimal | null | undefined) => (d ? d.toNumber() : 0);

/** Book serials in against a supplier invoice line. Serials already known stay as they are. */
export async function receiveSerials(
    tx: TenantTx,
    tenantId: string,
    input: { productId: string; supplierInvoiceLineId: string; serials: string[]; unitCost: number; receivedAt: Date },
): Promise<number> {
    let added = 0;
    for (const serial of input.serials) {
        const existing = await tx.serialUnit.findFirst({ where: { productId: input.productId, serial }, select: { id: true, state: true } });
        if (existing) {
            // The same serial coming back in — a return to the supplier and out again — goes back on the shelf.
            await tx.serialUnit.update({ where: { id: existing.id }, data: { state: "IN_STOCK", supplierInvoiceLineId: input.supplierInvoiceLineId, unitCost: input.unitCost, receivedAt: input.receivedAt, documentLineId: null, soldAt: null, warrantyUntil: null } });
            continue;
        }
        await tx.serialUnit.create({
            data: {
                tenantId, productId: input.productId, serial, state: "IN_STOCK",
                supplierInvoiceLineId: input.supplierInvoiceLineId, unitCost: input.unitCost, receivedAt: input.receivedAt,
            },
        });
        added++;
    }
    return added;
}

export type SerialProblem = { itemCode: string; message: string };

/**
 * Post the serials on a document's lines: sold on an invoice, back on the
 * shelf on a credit note. A serial nobody booked in is created on the way out
 * — parts often arrive before their paperwork, and refusing the sale would
 * teach people to leave the field empty.
 */
export async function postDocumentSerials(
    tx: TenantTx,
    tenantId: string,
    doc: { id: string; type: string; postDate: Date },
): Promise<SerialProblem[]> {
    const returning = doc.type === "CREDIT";
    if (!returning && doc.type !== "INVOICE" && doc.type !== "CASH_SALE") return [];
    const lines = await tx.documentLine.findMany({
        where: { documentId: doc.id, productId: { not: null }, serialNumbers: { not: null } },
        select: { id: true, quantity: true, unitCost: true, serialNumbers: true, product: { select: { id: true, itemCode: true, warrantyMonths: true } } },
    });

    const problems: SerialProblem[] = [];
    for (const line of lines) {
        const product = line.product;
        if (!product) continue;
        const serials = parseSerials(line.serialNumbers);
        if (serials.length === 0) continue;
        const known = await tx.serialUnit.findMany({
            where: { productId: product.id, serial: { in: serials } },
            select: { id: true, serial: true, state: true, documentLineId: true },
        });
        // Only a sale has to check: a unit already sold is exactly what a credit note takes back.
        const clash = returning ? null : allocationError(serials, known, line.id);
        if (clash) {
            problems.push({ itemCode: product.itemCode, message: clash });
            continue;
        }
        for (const serial of serials) {
            const unit = known.find((k) => k.serial === serial);
            const data = returning
                ? { state: "RETURNED" as const, documentLineId: line.id, soldAt: null, warrantyUntil: null }
                : { state: "SOLD" as const, documentLineId: line.id, soldAt: doc.postDate, warrantyUntil: warrantyUntil(doc.postDate, product.warrantyMonths) };
            if (unit) await tx.serialUnit.update({ where: { id: unit.id }, data });
            else await tx.serialUnit.create({ data: { tenantId, productId: product.id, serial, unitCost: num(line.unitCost), receivedAt: doc.postDate, ...data } });
        }
    }
    return problems;
}

/** Undo a document's serial movements: what it sold goes back on the shelf. */
export async function reverseDocumentSerials(tx: TenantTx, documentId: string): Promise<number> {
    const lines = await tx.documentLine.findMany({ where: { documentId }, select: { id: true } });
    const { count } = await tx.serialUnit.updateMany({
        where: { documentLineId: { in: lines.map((l) => l.id) } },
        data: { state: "IN_STOCK", documentLineId: null, soldAt: null, warrantyUntil: null },
    });
    return count;
}

export async function serialsForProduct(db: TenantDb, productId: string, take = 200) {
    const units = await db.serialUnit.findMany({
        where: { productId },
        orderBy: [{ state: "asc" }, { receivedAt: "desc" }],
        take,
        select: {
            id: true, serial: true, state: true, receivedAt: true, soldAt: true, warrantyUntil: true, unitCost: true, note: true,
            documentLine: { select: { document: { select: { id: true, type: true, number: true, customer: { select: { id: true, firstName: true, lastName: true } } } } } },
        },
    });
    return units.map((u) => ({
        id: u.id, serial: u.serial, state: u.state, receivedAt: u.receivedAt, soldAt: u.soldAt, warrantyUntil: u.warrantyUntil,
        unitCost: num(u.unitCost), note: u.note,
        document: u.documentLine?.document ?? null,
    }));
}

/** Answer "this one failed" from the serial alone. */
export async function findSerial(db: TenantDb, serial: string) {
    const cleaned = serial.trim().toUpperCase();
    if (cleaned.length < 2) return [];
    const units = await db.serialUnit.findMany({
        where: { serial: { contains: cleaned, mode: "insensitive" } },
        orderBy: { soldAt: "desc" },
        take: 25,
        select: {
            id: true, serial: true, state: true, soldAt: true, warrantyUntil: true, receivedAt: true,
            product: { select: { id: true, itemCode: true, description: true, warrantyMonths: true } },
            documentLine: { select: { document: { select: { id: true, type: true, number: true, postDate: true, customer: { select: { id: true, firstName: true, lastName: true } }, vehicle: { select: { plate: true } } } } } },
            supplierInvoiceLine: { select: { invoice: { select: { id: true, supplierNumber: true, supplier: { select: { companyName: true } } } } } },
        },
    });
    return units.map((u) => ({
        id: u.id, serial: u.serial, state: u.state, soldAt: u.soldAt, warrantyUntil: u.warrantyUntil, receivedAt: u.receivedAt,
        product: u.product,
        document: u.documentLine?.document ?? null,
        supplier: u.supplierInvoiceLine?.invoice ?? null,
    }));
}
