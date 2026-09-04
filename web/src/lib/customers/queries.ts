import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";

export type CustomerListParams = { q?: string; archived?: boolean; page?: number; size?: number };

export async function listCustomers(db: TenantDb, p: CustomerListParams) {
    const size = Math.min(Math.max(p.size ?? 25, 10), 100);
    const page = Math.max(p.page ?? 1, 1);
    const where: Prisma.CustomerWhereInput = {
        archivedAt: p.archived ? { not: null } : null,
        ...(p.q
            ? {
                  OR: [
                      { firstName: { contains: p.q, mode: "insensitive" } },
                      { lastName: { contains: p.q, mode: "insensitive" } },
                      { mobile: { contains: p.q } },
                      { phone: { contains: p.q } },
                      { email: { contains: p.q, mode: "insensitive" } },
                      { vehicles: { some: { plate: { contains: p.q, mode: "insensitive" } } } },
                  ],
              }
            : {}),
    };
    const [rows, total] = await Promise.all([
        db.customer.findMany({
            where,
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            skip: (page - 1) * size,
            take: size,
            select: { id: true, firstName: true, lastName: true, isBusiness: true, mobile: true, phone: true, email: true, archivedAt: true, _count: { select: { vehicles: true } } },
        }),
        db.customer.count({ where }),
    ]);
    return { rows, total, page, size, pages: Math.max(1, Math.ceil(total / size)) };
}

export async function getCustomer(db: TenantDb, id: string) {
    const c = await db.customer.findUnique({
        where: { id },
        include: {
            customerSource: true,
            vehicles: { where: { archivedAt: null }, orderBy: { plate: "asc" }, select: { id: true, plate: true, make: true, model: true, year: true, odometer: true, licenceExpiry: true, roadworthyExpiry: true } },
        },
    });
    if (!c) return null;
    // Decimal → number so the record can cross into client components
    return {
        ...c,
        hourlyRate: c.hourlyRate?.toNumber() ?? null,
        discountPercent: c.discountPercent.toNumber(),
        markupPercent: c.markupPercent.toNumber(),
        creditLimit: c.creditLimit?.toNumber() ?? null,
    };
}

export type CustomerRecord = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;

export async function listCustomerSources(db: TenantDb) {
    return db.customerSource.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
}
