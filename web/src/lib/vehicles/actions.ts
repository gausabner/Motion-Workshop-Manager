"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { type ActionState, bool, fromZod, str } from "@/lib/forms";
import { vehicleSchema } from "@/lib/vehicles/schema";

function read(fd: FormData) {
    const s = (n: string) => str(fd, n);
    return {
        customerId: s("customerId"), plate: s("plate"), vin: s("vin") ?? "", make: s("make"), model: s("model"), modelSeries: s("modelSeries"), year: s("year"),
        engineNumber: s("engineNumber"), chassisNumber: s("chassisNumber"), engineCode: s("engineCode"), fleetCode: s("fleetCode"),
        vehicleGroup: s("vehicleGroup"), bodyType: s("bodyType"), transmission: s("transmission"), driveType: s("driveType"), fuelType: s("fuelType"),
        cylinders: s("cylinders"), litres: s("litres"), hasAc: bool(fd, "hasAc"), seating: s("seating"), colour: s("colour"), tyreSize: s("tyreSize"), keyCode: s("keyCode"), radioPin: s("radioPin"),
        odometer: s("odometer"), engineHours: s("engineHours"),
        licenceExpiry: s("licenceExpiry"), roadworthyExpiry: s("roadworthyExpiry"), lastServiceDate: s("lastServiceDate"), nextServiceDate: s("nextServiceDate"),
        nextServiceKm: s("nextServiceKm"), serviceIntervalMonths: s("serviceIntervalMonths"), note: s("note"),
    };
}

export async function saveVehicle(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, membership, user, tenant } = await requireTenant(slug);
    assertCan(membership, "vehicles:write");
    const parsed = vehicleSchema.safeParse(read(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const data = { ...parsed.data, customerId: parsed.data.customerId || null };

    if (data.customerId) {
        const owner = await db.customer.findUnique({ where: { id: data.customerId }, select: { id: true } });
        if (!owner) return { ok: false, errors: { customerId: ["Customer not found"] } };
    }
    const clash = await db.vehicle.findFirst({ where: { plate: data.plate, archivedAt: null, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (clash) return { ok: false, errors: { plate: ["Another active vehicle already has this plate"] } };

    let savedId = id;
    if (id) {
        const existing = await db.vehicle.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return { ok: false, message: "Vehicle not found." };
        await db.vehicle.update({ where: { id }, data });
        await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Vehicle", entityId: id, action: "UPDATED" } });
    } else {
        const created = await db.vehicle.create({ data: { ...data, tenantId: tenant.id } });
        savedId = created.id;
        await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Vehicle", entityId: created.id, action: "CREATED" } });
    }
    revalidatePath(`/${tenant.slug}/dashboard/vehicles`);
    if (data.customerId) revalidatePath(`/${tenant.slug}/dashboard/customers/${data.customerId}`);
    redirect(`/${tenant.slug}/dashboard/vehicles/${savedId}?saved=1`);
}

export async function setVehicleArchived(slug: string, id: string, archived: boolean): Promise<void> {
    const { db, membership, user, tenant } = await requireTenant(slug);
    assertCan(membership, "vehicles:write");
    await db.vehicle.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Vehicle", entityId: id, action: archived ? "ARCHIVED" : "UNARCHIVED" } });
    revalidatePath(`/${tenant.slug}/dashboard/vehicles`);
    redirect(`/${tenant.slug}/dashboard/vehicles${archived ? "" : `/${id}`}`);
}
