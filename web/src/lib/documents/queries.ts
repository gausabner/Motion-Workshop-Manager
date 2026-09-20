import "server-only";
import type { DocumentType, JobStatus, Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { BOARD_COLUMNS } from "@/lib/documents/types";
import { amountDue, round2 } from "@/lib/documents/totals";

type Decimalish = { toNumber(): number };

/**
 * Prisma hands money back as Decimal, which cannot cross a server → client
 * boundary. This replaces every Decimal with a number, in the type as well as
 * at runtime, so pages can pass rows straight into client components.
 */
type Num<T> = [T] extends [Decimalish] ? number : [T] extends [Decimalish | null] ? number | null : T;
type Numeric<T> = { [K in keyof T]: Num<T[K]> };

function decimalsToNumbers<T extends Record<string, unknown>>(row: T): Numeric<T> {
    const out: Record<string, unknown> = { ...row };
    for (const [k, v] of Object.entries(out)) {
        if (v && typeof v === "object" && typeof (v as Partial<Decimalish>).toNumber === "function") {
            out[k] = (v as Decimalish).toNumber();
        }
    }
    return out as Numeric<T>;
}

/** Only posted payments count towards what a document has been paid. */
export const PROCESSED_ALLOCATIONS = { where: { payment: { state: "PROCESSED" as const } }, select: { amount: true } };

/** Paid and due are derived from allocations every time — never stored on the document. */
function balances(total: number, allocations: { amount: Decimalish }[]) {
    const amountPaid = round2(allocations.reduce((sum, a) => sum + a.amount.toNumber(), 0));
    return { amountPaid, amountDue: amountDue(total, amountPaid) };
}

export type DocumentListParams = {
    types?: DocumentType[];
    state?: "DRAFT" | "PROCESSED" | "CLOSED" | "VOID";
    jobStatus?: JobStatus;
    q?: string;
    from?: Date;
    to?: Date;
    unpaidOnly?: boolean;
    page?: number;
    size?: number;
};

export async function listDocuments(db: TenantDb, p: DocumentListParams) {
    const size = Math.min(Math.max(p.size ?? 25, 10), 100);
    const page = Math.max(p.page ?? 1, 1);
    const where: Prisma.DocumentWhereInput = {
        ...(p.types?.length ? { type: { in: p.types } } : {}),
        ...(p.state ? { state: p.state } : {}),
        ...(p.jobStatus ? { jobStatus: p.jobStatus } : {}),
        ...(p.from || p.to ? { postDate: { ...(p.from ? { gte: p.from } : {}), ...(p.to ? { lte: p.to } : {}) } } : {}),
        ...(p.unpaidOnly ? { state: "PROCESSED", type: { in: ["INVOICE", "CASH_SALE"] } } : {}),
        ...(p.q
            ? {
                  OR: [
                      { number: { contains: p.q, mode: "insensitive" } },
                      { jobNumber: { contains: p.q, mode: "insensitive" } },
                      { reference: { contains: p.q, mode: "insensitive" } },
                      { customerOrderNumber: { contains: p.q, mode: "insensitive" } },
                      { customer: { OR: [{ firstName: { contains: p.q, mode: "insensitive" } }, { lastName: { contains: p.q, mode: "insensitive" } }] } },
                      { vehicle: { plate: { contains: p.q, mode: "insensitive" } } },
                  ],
              }
            : {}),
    };

    const [rows, total] = await Promise.all([
        db.document.findMany({
            where,
            orderBy: [{ postDate: "desc" }, { createdAt: "desc" }],
            skip: (page - 1) * size,
            take: size,
            select: {
                id: true, type: true, state: true, jobStatus: true, statusComment: true, number: true, jobNumber: true, description: true,
                postDate: true, scheduledAt: true, dueDate: true, contactedAt: true, total: true,
                allocations: PROCESSED_ALLOCATIONS,
                customer: { select: { id: true, firstName: true, lastName: true } },
                vehicle: { select: { id: true, plate: true, make: true, model: true } },
                mechanic: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
            },
        }),
        db.document.count({ where }),
    ]);
    return {
        rows: rows.map(({ allocations, ...r }) => {
            const total = r.total.toNumber();
            return { ...r, total, ...balances(total, allocations) };
        }),
        total,
        page,
        size,
        pages: Math.max(1, Math.ceil(total / size)),
    };
}

export async function getDocument(db: TenantDb, id: string) {
    const doc = await db.document.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, firstName: true, lastName: true, mobile: true, email: true, priceType: true, discountPercent: true, vatExempt: true, paymentTermsDays: true } },
            vehicle: { select: { id: true, plate: true, make: true, model: true, year: true, odometer: true, vin: true, customerId: true, licenceExpiry: true, roadworthyExpiry: true, nextServiceKm: true, nextServiceDate: true, customer: { select: { firstName: true, lastName: true } } } },
            lines: { orderBy: { sortOrder: "asc" } },
            statusEvents: { orderBy: { at: "desc" }, take: 20, include: { by: { select: { user: { select: { firstName: true, lastName: true } } } } } },
            serviceAdvisor: { select: { id: true } },
            mechanic: { select: { id: true } },
            processedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
            sourceDocument: { select: { id: true, type: true, number: true } },
            derivedDocuments: { select: { id: true, type: true, number: true, state: true } },
            allocations: PROCESSED_ALLOCATIONS,
        },
    });
    if (!doc) return null;
    // `allocations` holds Decimals and is only needed to derive the balance — keep it off the client.
    const { allocations, ...rest } = doc;
    return {
        ...decimalsToNumbers(rest),
        ...balances(rest.total.toNumber(), allocations),
        customer: doc.customer ? { ...doc.customer, discountPercent: doc.customer.discountPercent.toNumber() } : null,
        lines: doc.lines.map((l) => decimalsToNumbers(l)),
    };
}

export type DocumentRecord = NonNullable<Awaited<ReturnType<typeof getDocument>>>;

/** Open job cards grouped into the board's columns (PRD TXN-03). */
export async function getJobBoard(db: TenantDb) {
    const rows = await db.document.findMany({
        where: { type: "JOB_CARD", state: "DRAFT", jobStatus: { in: BOARD_COLUMNS } },
        orderBy: [{ createdAt: "asc" }],
        select: {
            id: true, number: true, jobNumber: true, jobStatus: true, statusComment: true, createdAt: true, total: true,
            customer: { select: { firstName: true, lastName: true } },
            vehicle: { select: { plate: true, make: true, model: true } },
            mechanic: { select: { user: { select: { firstName: true, lastName: true } } } },
            _count: { select: { lines: true } },
            lines: { where: { lineType: "LABOUR" }, select: { quantity: true } },
        },
    });
    // `lines` is only here to sum labour hours — drop it so no Decimal reaches the client.
    return rows.map(({ lines, ...r }) => ({
        ...r,
        total: r.total.toNumber(),
        labourHours: round2(lines.reduce((sum, l) => sum + l.quantity.toNumber(), 0)),
    }));
}

/** Staff and products for the document editor. Customers and vehicles are searched on demand instead (R1c). */
export async function getEditorOptions(db: TenantDb) {
    const [advisors, mechanics, products, services] = await Promise.all([
        db.membership.findMany({ where: { status: "ACTIVE", isServiceAdvisor: true }, select: { id: true, user: { select: { firstName: true, lastName: true } } } }),
        db.membership.findMany({ where: { status: "ACTIVE", isMechanic: true }, select: { id: true, user: { select: { firstName: true, lastName: true } } } }),
        db.product.findMany({ where: { archivedAt: null }, orderBy: { itemCode: "asc" }, take: 500, select: {
            id: true, itemCode: true, description: true, type: true, vatExempt: true, retailPrice: true, price2: true, price3: true, price4: true,
            costExTax: true, defaultLabourQty: true, jobCardComment: true, isBundle: true, bundlePricing: true,
            bundleItems: {
                orderBy: { sortOrder: "asc" },
                select: { quantity: true, component: { select: { id: true, description: true, type: true, vatExempt: true, retailPrice: true, costExTax: true } } },
            },
        } }),
        db.appointmentType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, description: true, estimatedHours: true } }),
    ]);
    return {
        services: services.map((t) => ({ id: t.id, description: t.description, hours: t.estimatedHours.toNumber() })),
        advisors: advisors.map((m) => ({ id: m.id, name: `${m.user.firstName} ${m.user.lastName}` })),
        mechanics: mechanics.map((m) => ({ id: m.id, name: `${m.user.firstName} ${m.user.lastName}` })),
        products: products.map((p) => ({
            ...p,
            retailPrice: p.retailPrice.toNumber(),
            price2: p.price2.toNumber(),
            price3: p.price3.toNumber(),
            price4: p.price4.toNumber(),
            costExTax: p.costExTax.toNumber(),
            defaultLabourQty: p.defaultLabourQty?.toNumber() ?? null,
            bundleItems: p.bundleItems.map((b) => ({
                quantity: b.quantity.toNumber(),
                productId: b.component.id,
                description: b.component.description,
                type: b.component.type,
                vatExempt: b.component.vatExempt,
                retailPrice: b.component.retailPrice.toNumber(),
                costExTax: b.component.costExTax.toNumber(),
            })),
        })),
    };
}

export type EditorOptions = Awaited<ReturnType<typeof getEditorOptions>>;
