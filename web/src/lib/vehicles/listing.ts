import "server-only";
import type { TenantDb } from "@/lib/tenant-db";

/**
 * Every vehicle, for export. The counterpart to `customerListing`, and
 * separate from `listVehicles` for the same reason: that one is a paginated
 * screen query and this one must not stop short.
 *
 * The owner's name is on it but their contact details are not — the vehicle
 * list is a list of cars, and the renewals report is the one that exists to
 * ring people. Keeping the phone numbers out of this file means it can be
 * handed to a parts supplier or a fleet customer without a second thought.
 */

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type VehicleExportRow = {
    plate: string;
    vin: string;
    make: string;
    model: string;
    year: string;
    colour: string;
    fuel: string;
    transmission: string;
    engineNumber: string;
    fleetCode: string;
    odometer: string;
    customer: string;
    lastIn: string;
    lastService: string;
    nextService: string;
    licenceExpiry: string;
    roadworthyExpiry: string;
    jobs: number;
    archived: string;
};

export async function vehicleListing(db: TenantDb, includeArchived: boolean): Promise<VehicleExportRow[]> {
    const vehicles = await db.vehicle.findMany({
        where: includeArchived ? {} : { archivedAt: null },
        orderBy: [{ plate: "asc" }],
        select: {
            plate: true, vin: true, make: true, model: true, year: true, colour: true,
            fuelType: true, transmission: true, engineNumber: true, fleetCode: true, odometer: true,
            lastInDate: true, lastServiceDate: true, nextServiceDate: true,
            licenceExpiry: true, roadworthyExpiry: true, archivedAt: true,
            customer: { select: { firstName: true, lastName: true } },
            _count: { select: { documents: true } },
        },
    });

    return vehicles.map((v) => ({
        plate: v.plate,
        vin: v.vin ?? "",
        make: v.make,
        model: v.model,
        year: v.year === null ? "" : String(v.year),
        colour: v.colour ?? "",
        fuel: v.fuelType ?? "",
        transmission: v.transmission ?? "",
        engineNumber: v.engineNumber ?? "",
        fleetCode: v.fleetCode ?? "",
        odometer: v.odometer === null ? "" : String(v.odometer),
        customer: v.customer ? `${v.customer.firstName} ${v.customer.lastName}`.trim() : "",
        lastIn: iso(v.lastInDate),
        lastService: iso(v.lastServiceDate),
        nextService: iso(v.nextServiceDate),
        licenceExpiry: iso(v.licenceExpiry),
        roadworthyExpiry: iso(v.roadworthyExpiry),
        jobs: v._count.documents,
        archived: iso(v.archivedAt),
    }));
}
