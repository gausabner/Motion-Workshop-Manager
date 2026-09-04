import "server-only";
import type { Prisma } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";

export type VehicleListParams = { q?: string; archived?: boolean; page?: number; size?: number };

export async function listVehicles(db: TenantDb, p: VehicleListParams) {
    const size = Math.min(Math.max(p.size ?? 25, 10), 100);
    const page = Math.max(p.page ?? 1, 1);
    const where: Prisma.VehicleWhereInput = {
        archivedAt: p.archived ? { not: null } : null,
        ...(p.q
            ? {
                  OR: [
                      { plate: { contains: p.q, mode: "insensitive" } },
                      { vin: { contains: p.q, mode: "insensitive" } },
                      { make: { contains: p.q, mode: "insensitive" } },
                      { model: { contains: p.q, mode: "insensitive" } },
                      { fleetCode: { contains: p.q, mode: "insensitive" } },
                      { customer: { OR: [{ firstName: { contains: p.q, mode: "insensitive" } }, { lastName: { contains: p.q, mode: "insensitive" } }] } },
                  ],
              }
            : {}),
    };
    const [rows, total] = await Promise.all([
        db.vehicle.findMany({
            where,
            orderBy: [{ plate: "asc" }],
            skip: (page - 1) * size,
            take: size,
            select: { id: true, plate: true, make: true, model: true, year: true, odometer: true, licenceExpiry: true, roadworthyExpiry: true, customer: { select: { id: true, firstName: true, lastName: true } } },
        }),
        db.vehicle.count({ where }),
    ]);
    return { rows, total, page, size, pages: Math.max(1, Math.ceil(total / size)) };
}

export async function getVehicle(db: TenantDb, id: string) {
    const v = await db.vehicle.findUnique({ where: { id }, include: { customer: { select: { id: true, firstName: true, lastName: true } } } });
    if (!v) return null;
    return { ...v, litres: v.litres?.toNumber() ?? null, engineHours: v.engineHours?.toNumber() ?? null };
}

export type VehicleRecord = NonNullable<Awaited<ReturnType<typeof getVehicle>>>;

/** Active customers as select options (name, mobile). */
export async function listCustomerOptions(db: TenantDb) {
    const rows = await db.customer.findMany({ where: { archivedAt: null }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true, mobile: true } });
    return rows.map((c) => ({ value: c.id, label: `${c.lastName}, ${c.firstName}${c.mobile ? ` · ${c.mobile}` : ""}` }));
}
