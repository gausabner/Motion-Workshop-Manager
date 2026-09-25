import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { toCsv } from "@/lib/accounting/export";
import { zip, type ZipEntry } from "@/lib/handoff/zip";

/**
 * Everything, as one archive.
 *
 * This is the concrete form of a promise that is otherwise just a sentence in
 * a proposal: that a workshop's data is never withheld. It is also the answer
 * council IT asks for before signing — "if we stop paying you, or you stop
 * existing, what do we have?" — and "an export screen you can visit eleven
 * times" is not an answer that survives that meeting.
 *
 * Deliberately flat CSV per table rather than a database dump. A dump is only
 * useful to somebody running the same version of the same product, which is
 * precisely the dependency the bundle exists to dissolve. A directory of CSVs
 * opens in anything, forever, and the README in the archive says how the
 * tables join.
 *
 * Ids are included, which the on-screen exports leave out. A person reading a
 * report does not want a cuid in a column; a person reconstructing the data
 * somewhere else cannot do it without one.
 *
 * Contact details are not redacted here, and that is a decision rather than an
 * oversight: the bundle is owner self-service, gated on `settings:manage`, and
 * a workshop owner taking their own customer list is the entire point. The
 * download is audited like every other, so the record of who took it exists.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const num = (d: { toNumber(): number } | null | undefined) => (d ? String(d.toNumber()) : "");
const bool = (b: boolean | null | undefined) => (b ? "true" : "false");

export type BundleTable = { name: string; rows: number; csv: string };

/**
 * Every table, in an order that reads like the business rather than like the
 * schema: who the customers are, what they drive, what was done, what was
 * charged, what was paid, what is on the shelves, and who did it.
 */
export async function bundleTables(db: TenantDb): Promise<BundleTable[]> {
    const table = (name: string, headers: string[], rows: (string | number | null)[][]): BundleTable =>
        ({ name, rows: rows.length, csv: toCsv(headers, rows) });

    const [customers, vehicles, documents, lines, payments, allocations, products, movements, suppliers, supplierInvoices, timeEntries, audit] =
        await Promise.all([
            db.customer.findMany({ orderBy: { createdAt: "asc" } }),
            db.vehicle.findMany({ orderBy: { createdAt: "asc" } }),
            db.document.findMany({ orderBy: { createdAt: "asc" } }),
            db.documentLine.findMany({ orderBy: { id: "asc" } }),
            db.payment.findMany({ orderBy: { createdAt: "asc" } }),
            db.paymentAllocation.findMany({ orderBy: { id: "asc" } }),
            db.product.findMany({ orderBy: { itemCode: "asc" } }),
            db.stockMovement.findMany({ orderBy: { at: "asc" } }),
            db.supplier.findMany({ orderBy: { companyName: "asc" } }),
            db.supplierInvoice.findMany({ orderBy: { createdAt: "asc" } }),
            db.timeEntry.findMany({ orderBy: { startedAt: "asc" } }),
            db.auditEvent.findMany({ orderBy: { at: "asc" } }),
        ]);

    return [
        table("customers", ["id", "firstName", "lastName", "isBusiness", "vatNumber", "mobile", "phone", "email", "streetAddress1", "streetSuburb", "streetCity", "streetPostcode", "paymentTermsDays", "createdAt", "archivedAt"],
            customers.map((c) => [c.id, c.firstName, c.lastName, bool(c.isBusiness), c.vatNumber, c.mobile, c.phone, c.email, c.streetAddress1, c.streetSuburb, c.streetCity, c.streetPostcode, c.paymentTermsDays, iso(c.createdAt), iso(c.archivedAt)])),

        table("vehicles", ["id", "customerId", "plate", "vin", "make", "model", "year", "colour", "odometer", "licenceExpiry", "roadworthyExpiry", "nextServiceDate", "createdAt", "archivedAt"],
            vehicles.map((v) => [v.id, v.customerId, v.plate, v.vin, v.make, v.model, v.year, v.colour, v.odometer, day(v.licenceExpiry), day(v.roadworthyExpiry), day(v.nextServiceDate), iso(v.createdAt), iso(v.archivedAt)])),

        table("documents", ["id", "type", "state", "number", "jobNumber", "customerId", "vehicleId", "postDate", "dueDate", "description", "taxName", "taxRate", "pricesIncludeTax", "subtotal", "vatTotal", "total", "isInternal", "processedAt", "voidedAt", "voidReason", "sourceDocumentId", "createdAt"],
            documents.map((d) => [d.id, d.type, d.state, d.number, d.jobNumber, d.customerId, d.vehicleId, day(d.postDate), day(d.dueDate), d.description, d.taxName, num(d.taxRate), bool(d.pricesIncludeTax), num(d.subtotal), num(d.vatTotal), num(d.total), bool(d.isInternal), iso(d.processedAt), iso(d.voidedAt), d.voidReason, d.sourceDocumentId, iso(d.createdAt)])),

        table("document_lines", ["id", "documentId", "productId", "lineType", "description", "quantity", "unitPrice", "unitCost", "vatRate", "discountPercent"],
            lines.map((l) => [l.id, l.documentId, l.productId, l.lineType, l.description, num(l.quantity), num(l.unitPrice), num(l.unitCost), num(l.vatRate), num(l.discountPercent)])),

        table("payments", ["id", "number", "state", "customerId", "postDate", "amount", "note", "processedAt", "voidedAt", "voidReason", "createdAt"],
            payments.map((p) => [p.id, p.number, p.state, p.customerId, day(p.postDate), num(p.amount), p.note, iso(p.processedAt), iso(p.voidedAt), p.voidReason, iso(p.createdAt)])),

        table("payment_allocations", ["id", "paymentId", "documentId", "amount"],
            allocations.map((a) => [a.id, a.paymentId, a.documentId, num(a.amount)])),

        table("products", ["id", "itemCode", "description", "groupId", "supplierId", "type", "qtyOnHand", "minQty", "costExTax", "retailPrice", "location", "archivedAt"],
            products.map((p) => [p.id, p.itemCode, p.description, p.groupId, p.supplierId, p.type, num(p.qtyOnHand), num(p.minQty), num(p.costExTax), num(p.retailPrice), p.location, iso(p.archivedAt)])),

        table("stock_movements", ["id", "productId", "documentId", "kind", "quantity", "unitCost", "note", "at"],
            movements.map((m) => [m.id, m.productId, m.documentId, m.kind, num(m.quantity), num(m.unitCost), m.note, iso(m.at)])),

        table("suppliers", ["id", "companyName", "accountNumber", "vatNumber", "phone", "city", "archivedAt"],
            suppliers.map((s) => [s.id, s.companyName, s.accountNumber, s.vatNumber, s.phone, s.city, iso(s.archivedAt)])),

        table("supplier_invoices", ["id", "supplierId", "supplierNumber", "state", "postDate", "dueDate", "taxName", "taxRate", "subtotal", "taxTotal", "total"],
            supplierInvoices.map((i) => [i.id, i.supplierId, i.supplierNumber, i.state, day(i.postDate), day(i.dueDate), i.taxName, num(i.taxRate), num(i.subtotal), num(i.taxTotal), num(i.total)])),

        table("time_entries", ["id", "documentId", "mechanicId", "startedAt", "endedAt", "minutes"],
            timeEntries.map((t) => [t.id, t.documentId, t.mechanicId, iso(t.startedAt), iso(t.endedAt), t.minutes])),

        table("audit_events", ["id", "at", "actorUserId", "entityType", "entityId", "action"],
            audit.map((a) => [a.id, iso(a.at), a.actorUserId, a.entityType, a.entityId, a.action])),
    ];
}

/**
 * What the archive says about itself.
 *
 * Written for somebody who has the ZIP and does not have MOTION — which, if
 * this file is ever genuinely needed, is the only person who will read it.
 */
function readme(tenant: Tenant, tables: BundleTable[], at: Date): string {
    const widest = Math.max(...tables.map((t) => t.name.length));
    const list = tables.map((t) => `  ${t.name.padEnd(widest)}  ${String(t.rows).padStart(7)} rows`).join("\n");
    return `${tenant.name} — everything MOTION holds
${"=".repeat(60)}

Taken ${at.toISOString()} (${tenant.timezone}).

This is a complete copy of this workshop's data as comma-separated files, one
per table. It needs no software of ours to read: open any file in a
spreadsheet, or load the lot into whatever you like.

Files
-----
${list}

How they join
-------------
  vehicles.customerId            -> customers.id
  documents.customerId           -> customers.id
  documents.vehicleId            -> vehicles.id
  documents.sourceDocumentId     -> documents.id     (a copy, conversion or credit)
  document_lines.documentId      -> documents.id
  document_lines.productId       -> products.id      (blank when typed in by hand)
  payment_allocations.paymentId  -> payments.id
  payment_allocations.documentId -> documents.id
  stock_movements.productId      -> products.id
  supplier_invoices.supplierId   -> suppliers.id
  time_entries.documentId        -> documents.id

Things worth knowing
--------------------
  * Money is a plain decimal. The currency is ${tenant.currency} throughout.
  * Dates are ISO — 2026-09-24 — and timestamps are UTC with a Z on the end.
  * Tax is stored on each document as it was when the document was raised,
    not as the workshop's setting is today. A period spanning a rate change
    will therefore show both rates, and that is correct.
  * What a document has been paid is not stored on it. It is the sum of the
    payment_allocations that point at it, which is why a total and a balance
    can never drift apart.
  * A credit note is stored as the sale run backwards, with negative
    quantities and amounts. It does not need its sign flipping.
  * Documents that were voided are still here, with voidedAt set. Nothing is
    ever deleted outright, which is what lets the number sequence be proved
    complete.
`;
}

export async function buildBundle(db: TenantDb, tenant: Tenant, at: Date = new Date()): Promise<{ body: Buffer; tables: BundleTable[]; rows: number }> {
    const tables = await bundleTables(db);
    const entries: ZipEntry[] = [
        { name: "README.txt", body: readme(tenant, tables, at) },
        // A byte-order mark on each, for the same reason every other CSV
        // MOTION writes has one: these are opened in Excel on Windows.
        ...tables.map((t): ZipEntry => ({ name: `${t.name}.csv`, body: `﻿${t.csv}` })),
    ];
    return { body: zip(entries, at), tables, rows: tables.reduce((total, t) => total + t.rows, 0) };
}
