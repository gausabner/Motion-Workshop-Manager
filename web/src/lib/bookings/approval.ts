import "server-only";
import type { Tenant } from "@prisma/client";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { allocateNumber } from "@/lib/documents/numbering";
import { toInternational } from "@/lib/messaging/phone";
import { businessToday } from "@/lib/tenant/today";
import { normalisePlate, parseVehicleDescription, plateDigits, vehicleDecision, type VehicleMatch } from "@/lib/bookings/matching";

/**
 * Turning an online request into a booking in the diary (R4), in a plain
 * module so the rules run against a real database in a check.
 */

type Request = { mobile: string; email: string | null; plate: string | null };

export type Matches = {
    customer: { id: string; name: string } | null;
    vehicle: (VehicleMatch & { owner: string | null }) | null;
    decision: ReturnType<typeof vehicleDecision>;
};

/** Is this someone we know? Mobile first — it is how Namibian customers are identified — then email. */
export async function findMatches(db: TenantDb | TenantTx, tenant: Tenant, request: Request): Promise<Matches> {
    const digits = toInternational(request.mobile, tenant.country);
    let customer: { id: string; name: string } | null = null;

    if (digits) {
        // Narrow by the last four digits — the only run that stays together however a
        // number is written ("744 4912", "7444912", "744-4912") — then compare properly.
        const candidates = await db.customer.findMany({
            where: { archivedAt: null, mobile: { contains: digits.slice(-4) } },
            select: { id: true, firstName: true, lastName: true, mobile: true },
            take: 500,
        });
        const hit = candidates.find((c) => toInternational(c.mobile, tenant.country) === digits);
        if (hit) customer = { id: hit.id, name: `${hit.firstName} ${hit.lastName}`.trim() };
    }
    if (!customer && request.email) {
        const hit = await db.customer.findFirst({ where: { archivedAt: null, email: { equals: request.email, mode: "insensitive" } }, select: { id: true, firstName: true, lastName: true } });
        if (hit) customer = { id: hit.id, name: `${hit.firstName} ${hit.lastName}`.trim() };
    }

    let vehicle: Matches["vehicle"] = null;
    if (request.plate && normalisePlate(request.plate)) {
        const wanted = normalisePlate(request.plate);
        const candidates = await db.vehicle.findMany({
            where: { plate: { contains: plateDigits(request.plate) || wanted.slice(0, 3), mode: "insensitive" } },
            select: { id: true, plate: true, customerId: true, customer: { select: { firstName: true, lastName: true } } },
            take: 50,
        });
        const hit = candidates.find((v) => normalisePlate(v.plate) === wanted);
        if (hit) vehicle = { id: hit.id, plate: hit.plate, customerId: hit.customerId, owner: hit.customer ? `${hit.customer.firstName} ${hit.customer.lastName}` : null };
    }

    return { customer, vehicle, decision: vehicleDecision(vehicle, customer?.id ?? null) };
}

export async function approveRequest(
    tx: TenantTx,
    tenant: Tenant,
    membershipId: string,
    requestId: string,
    options: { mechanicId: string | null },
): Promise<{ documentId: string; createdCustomer: boolean; vehicle: "attached" | "adopted" | "created" | "conflict" | "none" }> {
    const request = await tx.bookingRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error("That request is no longer there");
    if (request.status !== "PENDING") throw new Error(`That request was already ${request.status.toLowerCase()}`);

    if (options.mechanicId) {
        const mechanic = await tx.membership.findUnique({ where: { id: options.mechanicId }, select: { status: true, isMechanic: true, showOnDiary: true } });
        if (!mechanic || mechanic.status !== "ACTIVE" || !(mechanic.isMechanic || mechanic.showOnDiary)) throw new Error("That person is not on the diary");
    }

    const matches = await findMatches(tx, tenant, request);
    let customerId = matches.customer?.id ?? null;
    let createdCustomer = false;
    if (!customerId) {
        const created = await tx.customer.create({
            data: {
                tenantId: tenant.id,
                firstName: request.firstName,
                lastName: request.lastName,
                mobile: request.mobile,
                email: request.email,
                preferredContact: "WHATSAPP",
                note: "Created from an online booking",
            },
            select: { id: true },
        });
        customerId = created.id;
        createdCustomer = true;
    }

    // The decision is taken again now the customer is settled — a brand-new customer cannot own an existing car.
    const decision = vehicleDecision(matches.vehicle, customerId);
    let vehicleId: string | null = null;
    let vehicle: "attached" | "adopted" | "created" | "conflict" | "none" = "none";
    if (matches.vehicle && decision === "attach") {
        vehicleId = matches.vehicle.id;
        vehicle = "attached";
    } else if (matches.vehicle && decision === "adopt") {
        await tx.vehicle.update({ where: { id: matches.vehicle.id }, data: { customerId } });
        vehicleId = matches.vehicle.id;
        vehicle = "adopted";
    } else if (decision === "conflict") {
        vehicle = "conflict";
    } else if (request.plate) {
        const parsed = parseVehicleDescription(request.vehicleDescription);
        const created = await tx.vehicle.create({
            data: { tenantId: tenant.id, customerId, plate: request.plate.toUpperCase().trim(), make: parsed.make, model: parsed.model, year: parsed.year },
            select: { id: true },
        });
        vehicleId = created.id;
        vehicle = "created";
    }

    const notes = [
        request.notes ? `Customer's note: ${request.notes}` : null,
        vehicle === "conflict" ? `Booked online for plate ${request.plate}, which is on file for ${matches.vehicle?.owner ?? "another customer"} — check before starting.` : null,
        request.vehicleDescription && vehicle !== "attached" ? `Vehicle as described: ${request.vehicleDescription}` : null,
        "Booked online.",
    ].filter(Boolean).join("\n");

    const jobNumber = await allocateNumber(tx, tenant.id, "JOB");
    const doc = await tx.document.create({
        data: {
            tenantId: tenant.id,
            type: "BOOKING",
            state: "DRAFT",
            jobStatus: "BOOKED_IN",
            jobNumber,
            customerId,
            vehicleId,
            mechanicId: options.mechanicId,
            scheduledAt: request.requestedAt,
            estimatedHours: Math.round((request.minutes / 60) * 100) / 100,
            description: request.service,
            eventNotes: notes,
            postDate: businessToday(tenant.timezone),
            paymentTermsDays: tenant.defaultPaymentTermsDays,
            taxName: tenant.taxName,
            taxRate: tenant.salesTaxRate,
            pricesIncludeTax: tenant.pricesIncludeTax,
            createdById: membershipId,
        },
        select: { id: true },
    });

    await tx.bookingRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", decidedById: membershipId, decidedAt: new Date(), documentId: doc.id, customerId },
    });
    return { documentId: doc.id, createdCustomer, vehicle };
}

export async function declineRequest(tx: TenantTx, membershipId: string, requestId: string, reason: string): Promise<void> {
    const request = await tx.bookingRequest.findUnique({ where: { id: requestId }, select: { status: true } });
    if (!request) throw new Error("That request is no longer there");
    if (request.status !== "PENDING") throw new Error(`That request was already ${request.status.toLowerCase()}`);
    await tx.bookingRequest.update({ where: { id: requestId }, data: { status: "DECLINED", decidedById: membershipId, decidedAt: new Date(), declineReason: reason } });
}
