import "server-only";
import type { TenantDb } from "@/lib/tenant-db";
import { actionDetail, actionWords } from "@/lib/audit/words";

/**
 * The transaction log: everything anybody did, between two dates.
 *
 * The per-document history answers "what happened to this invoice". An auditor
 * asks the other question — "what happened in March" — and then narrows it to
 * one person. Until now neither could be answered at all, because the events
 * were only ever read one entity at a time.
 *
 * Three things make this usable as evidence rather than as a curiosity.
 *
 * **The entity is named, not numbered.** A row saying `Document cmf3k…` proves
 * nothing to somebody holding a paper invoice. Each event is resolved to the
 * thing it touched — the invoice number, the customer's name, the payment
 * reference — in one lookup per kind rather than one per row.
 *
 * **A deletion carries what was deleted.** The snapshot taken before the row
 * went is printed in the detail column. A log that records the act but not the
 * content cannot settle whether a deletion was honest.
 *
 * **It is paged.** A busy workshop writes tens of thousands of events a year
 * and there is no natural ceiling on a period, so nothing here loads a whole
 * year into memory to count it.
 */

export type LogRow = {
    at: Date;
    actor: string;
    action: string;
    entity: string;
    reference: string;
    detail: string;
};

export type LogFilter = {
    from: Date;
    to: Date;
    /** One person, when the question is about one person. */
    actorUserId?: string;
    /** "Document", "Payment", and so on. */
    entityType?: string;
};

/** What each entity type is called on the page, rather than in the schema. */
const KIND: Record<string, string> = {
    Document: "Document",
    Payment: "Receipt",
    SupplierPayment: "Supplier payment",
    SupplierInvoice: "Supplier invoice",
    PurchaseOrder: "Purchase order",
    Customer: "Customer",
    Vehicle: "Vehicle",
    Product: "Product",
    StockTake: "Stock take",
    Membership: "Team member",
    Tenant: "Workshop settings",
    Export: "Export",
};

const where = (f: LogFilter) => ({
    at: { gte: f.from, lte: f.to },
    ...(f.actorUserId ? { actorUserId: f.actorUserId } : {}),
    ...(f.entityType ? { entityType: f.entityType } : {}),
});

export function countAudit(db: TenantDb, filter: LogFilter): Promise<number> {
    return db.auditEvent.count({ where: where(filter) });
}

/**
 * One page of the log, oldest first.
 *
 * Oldest first on purpose: a register is read forwards, and an auditor
 * following a day's events wants them in the order they happened. The
 * on-screen history is the opposite because there the question is "what
 * changed most recently".
 */
export async function auditForPeriod(db: TenantDb, filter: LogFilter, skip = 0, take = 1000): Promise<LogRow[]> {
    const events = await db.auditEvent.findMany({
        where: where(filter),
        orderBy: [{ at: "asc" }, { id: "asc" }],
        skip,
        take,
        select: { at: true, action: true, diff: true, actorUserId: true, entityType: true, entityId: true },
    });
    if (events.length === 0) return [];

    const names = await actorNames(db, events.map((e) => e.actorUserId));
    const labels = await entityLabels(db, events);

    return events.map((e) => ({
        at: e.at,
        // An event with no actor came from the customer's own device — an
        // approval through a share link — or from a scheduled job. Saying so
        // beats an empty cell that reads as missing data.
        actor: e.actorUserId ? (names.get(e.actorUserId) ?? "A user who has since left") : "Not a signed-in user",
        action: actionWords(e.action),
        entity: KIND[e.entityType] ?? e.entityType,
        reference: reference(labels, e.entityType, e.entityId),
        detail: actionDetail(e.action, e.diff) ?? "",
    }));
}

/**
 * Which record the event was about.
 *
 * When the lookup for a kind MOTION knows how to name comes back empty, the
 * record has been deleted — and printing a bare database id in front of an
 * auditor invites the question "what is that", to which the answer is a
 * shrug. The id is still shown, because it is the only handle left on the
 * thing, but it is shown as what it is.
 */
function reference(labels: Map<string, string>, entityType: string, entityId: string): string {
    const found = labels.get(`${entityType}:${entityId}`);
    if (found) return found;
    if (LABELLED.has(entityType)) return `${entityId} (no longer in MOTION)`;
    return entityId;
}

/** The kinds `entityLabels` knows how to name, so a miss means "gone". */
const LABELLED = new Set(["Document", "Payment", "Customer", "Vehicle", "Product", "SupplierInvoice"]);

async function actorNames(db: TenantDb, ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const people = await db.membership.findMany({
        where: { userId: { in: unique } },
        select: { userId: true, user: { select: { firstName: true, lastName: true } } },
    });
    return new Map(people.map((m) => [m.userId, `${m.user.firstName} ${m.user.lastName}`.trim()]));
}

/**
 * The human name of everything the page touched, in one query per kind.
 *
 * A row per event would be a thousand queries for a thousand events, which is
 * how an audit export becomes a timeout on the day somebody actually needs it.
 */
async function entityLabels(
    db: TenantDb,
    events: { entityType: string; entityId: string }[],
): Promise<Map<string, string>> {
    const byType = new Map<string, string[]>();
    for (const e of events) {
        const ids = byType.get(e.entityType) ?? [];
        ids.push(e.entityId);
        byType.set(e.entityType, ids);
    }
    const out = new Map<string, string>();
    const put = (type: string, id: string, label: string) => out.set(`${type}:${id}`, label);
    const idsFor = (type: string) => [...new Set(byType.get(type) ?? [])];

    const person = (c: { firstName: string; lastName: string } | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : "");

    await Promise.all([
        (async () => {
            const ids = idsFor("Document");
            if (ids.length === 0) return;
            const rows = await db.document.findMany({
                where: { id: { in: ids } },
                select: { id: true, type: true, number: true, jobNumber: true, customer: { select: { firstName: true, lastName: true } } },
            });
            for (const r of rows) {
                const number = r.number ?? r.jobNumber ?? "(no number)";
                put("Document", r.id, [`${r.type.toLowerCase().replace(/_/g, " ")} ${number}`, person(r.customer)].filter(Boolean).join(" · "));
            }
        })(),
        (async () => {
            const ids = idsFor("Payment");
            if (ids.length === 0) return;
            const rows = await db.payment.findMany({
                where: { id: { in: ids } },
                select: { id: true, number: true, customer: { select: { firstName: true, lastName: true } } },
            });
            for (const r of rows) put("Payment", r.id, [r.number ?? "(no number)", person(r.customer)].filter(Boolean).join(" · "));
        })(),
        (async () => {
            const ids = idsFor("Customer");
            if (ids.length === 0) return;
            const rows = await db.customer.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } });
            for (const r of rows) put("Customer", r.id, person(r));
        })(),
        (async () => {
            const ids = idsFor("Vehicle");
            if (ids.length === 0) return;
            const rows = await db.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true, plate: true, make: true, model: true } });
            for (const r of rows) put("Vehicle", r.id, [r.plate, [r.make, r.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "));
        })(),
        (async () => {
            const ids = idsFor("Product");
            if (ids.length === 0) return;
            const rows = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, itemCode: true, description: true } });
            for (const r of rows) put("Product", r.id, [r.itemCode, r.description].filter(Boolean).join(" · "));
        })(),
        (async () => {
            const ids = idsFor("SupplierInvoice");
            if (ids.length === 0) return;
            const rows = await db.supplierInvoice.findMany({
                where: { id: { in: ids } },
                select: { id: true, supplierNumber: true, supplier: { select: { companyName: true } } },
            });
            for (const r of rows) put("SupplierInvoice", r.id, [r.supplierNumber, r.supplier.companyName].filter(Boolean).join(" · "));
        })(),
    ]);

    return out;
}
