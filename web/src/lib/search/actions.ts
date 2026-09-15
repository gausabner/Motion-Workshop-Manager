"use server";

import type { Prisma } from "@prisma/client";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { fromZod } from "@/lib/forms";
import { customerSchema } from "@/lib/customers/schema";
import { vehicleSchema } from "@/lib/vehicles/schema";
import type { PickerHit, QuickCreateResult, VehicleHit } from "@/lib/search/types";
import { customerHit, vehicleHit } from "@/lib/search/hits";

/**
 * Server-side search behind the customer and vehicle pickers (R1c).
 *
 * The previous `<select>` shipped every customer to the browser, which is fine
 * for nine and unusable for three thousand. These return a dozen matches for
 * whatever has been typed, scoped to the workshop by `requireTenant`.
 */

const LIMIT = 12;

const CUSTOMER_SELECT = { id: true, firstName: true, lastName: true, mobile: true, email: true } as const;
const VEHICLE_SELECT = {
    id: true, plate: true, make: true, model: true, year: true, customerId: true,
    customer: { select: { firstName: true, lastName: true } },
} as const;

/** Words in the query, capped so a pasted paragraph cannot build a huge query. */
function tokensOf(query: string): string[] {
    return query.trim().slice(0, 80).split(/\s+/).filter(Boolean).slice(0, 4);
}

/**
 * Customers matching every word typed, each word against name, mobile, phone,
 * email or any of their plates — so "courtney farrell" and "farrell 12345"
 * both find her. An empty query returns the most recently updated customers.
 */
export async function searchCustomers(slug: string, query: string): Promise<PickerHit[]> {
    const { db } = await requireTenant(slug);
    const tokens = tokensOf(query);
    const where: Prisma.CustomerWhereInput = {
        archivedAt: null,
        ...(tokens.length
            ? {
                  AND: tokens.map((t): Prisma.CustomerWhereInput => ({
                      OR: [
                          { firstName: { contains: t, mode: "insensitive" } },
                          { lastName: { contains: t, mode: "insensitive" } },
                          { mobile: { contains: t } },
                          { phone: { contains: t } },
                          { email: { contains: t, mode: "insensitive" } },
                          { vehicles: { some: { plate: { contains: t, mode: "insensitive" }, archivedAt: null } } },
                      ],
                  })),
              }
            : {}),
    };
    const rows = await db.customer.findMany({
        where,
        orderBy: tokens.length ? [{ lastName: "asc" }, { firstName: "asc" }] : [{ updatedAt: "desc" }],
        take: LIMIT,
        select: CUSTOMER_SELECT,
    });
    return rows.map(customerHit);
}

/**
 * Vehicles matching every word typed, against plate, VIN, make, model, fleet
 * code or owner name. When a customer is given, only their vehicles are
 * searched, and an empty query lists all of them.
 */
export async function searchVehicles(slug: string, query: string, customerId?: string | null): Promise<VehicleHit[]> {
    const { db } = await requireTenant(slug);
    const tokens = tokensOf(query);
    const where: Prisma.VehicleWhereInput = {
        archivedAt: null,
        ...(customerId ? { customerId } : {}),
        ...(tokens.length
            ? {
                  AND: tokens.map((t): Prisma.VehicleWhereInput => ({
                      OR: [
                          { plate: { contains: t, mode: "insensitive" } },
                          { vin: { contains: t, mode: "insensitive" } },
                          { make: { contains: t, mode: "insensitive" } },
                          { model: { contains: t, mode: "insensitive" } },
                          { fleetCode: { contains: t, mode: "insensitive" } },
                          { customer: { OR: [{ firstName: { contains: t, mode: "insensitive" } }, { lastName: { contains: t, mode: "insensitive" } }] } },
                      ],
                  })),
              }
            : {}),
    };
    const rows = await db.vehicle.findMany({
        where,
        orderBy: tokens.length ? [{ plate: "asc" }] : [{ updatedAt: "desc" }],
        take: LIMIT,
        select: VEHICLE_SELECT,
    });
    return rows.map(vehicleHit);
}

/** Create a customer from the picker with just enough to raise a document. */
export async function quickCreateCustomer(
    slug: string,
    input: { firstName?: string; lastName?: string; mobile?: string; email?: string },
): Promise<QuickCreateResult<PickerHit>> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "customers:write");

    const mobile = input.mobile?.trim() || undefined;
    const parsed = customerSchema.safeParse({
        firstName: input.firstName,
        lastName: input.lastName,
        mobile,
        email: input.email?.trim() ?? "",
        preferredContact: mobile ? "WHATSAPP" : "EMAIL",
    });
    if (!parsed.success) {
        const r = fromZod(parsed.error);
        return { ok: false, message: r.message, errors: r.errors };
    }

    // The same person already on file? Point at them rather than create a duplicate (PRD CUST-03).
    if (parsed.data.mobile) {
        const existing = await db.customer.findFirst({ where: { archivedAt: null, mobile: parsed.data.mobile }, select: CUSTOMER_SELECT });
        if (existing) {
            return { ok: false, errors: { mobile: [`${existing.firstName} ${existing.lastName} already has this number — search for them instead`] } };
        }
    }

    const created = await db.customer.create({ data: { ...parsed.data, tenantId: tenant.id }, select: CUSTOMER_SELECT });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Customer", entityId: created.id, action: "CREATED", diff: { via: "picker" } } });
    return { ok: true, hit: customerHit(created) };
}

/** Create a vehicle from the picker, owned by the document's customer when there is one. */
export async function quickCreateVehicle(
    slug: string,
    input: { plate?: string; make?: string; model?: string; customerId?: string | null },
): Promise<QuickCreateResult<VehicleHit>> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "vehicles:write");

    const parsed = vehicleSchema.safeParse({ plate: input.plate, make: input.make, model: input.model, customerId: input.customerId || undefined, vin: "" });
    if (!parsed.success) {
        const r = fromZod(parsed.error);
        return { ok: false, message: r.message, errors: r.errors };
    }
    const data = { ...parsed.data, customerId: parsed.data.customerId || null };

    if (data.customerId) {
        const owner = await db.customer.findUnique({ where: { id: data.customerId }, select: { id: true } });
        if (!owner) return { ok: false, message: "That customer no longer exists." };
    }
    const clash = await db.vehicle.findFirst({ where: { plate: data.plate, archivedAt: null }, select: VEHICLE_SELECT });
    if (clash) {
        const hit = vehicleHit(clash);
        return { ok: false, errors: { plate: [`${hit.label} is already on file${hit.ownerLabel ? ` for ${hit.ownerLabel}` : ""} — search for it instead`] } };
    }

    const created = await db.vehicle.create({ data: { ...data, tenantId: tenant.id }, select: VEHICLE_SELECT });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Vehicle", entityId: created.id, action: "CREATED", diff: { via: "picker" } } });
    return { ok: true, hit: vehicleHit(created) };
}
