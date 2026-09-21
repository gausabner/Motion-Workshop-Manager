import { z } from "zod";
import { withKey } from "@/lib/api/auth";
import { cursorArgs, fail, json, page, paging } from "@/lib/api/http";
import { VEHICLE_SELECT, vehicleShape } from "@/lib/api/shapes";
import { createLinked, lookupByExternalId } from "@/lib/api/external";

/** `?plate=` is how every caller actually looks a vehicle up, so it is a first-class filter. */
export const GET = withKey("READ", async (caller, req) => {
    const url = new URL(req.url);
    const { limit, cursor } = paging(url);
    const plate = url.searchParams.get("plate");
    const customerId = url.searchParams.get("customerId");
    const externalId = url.searchParams.get("externalId");

    if (externalId) {
        const id = await lookupByExternalId(caller, "vehicle", externalId);
        const row = id ? await caller.db.vehicle.findUnique({ where: { id }, select: VEHICLE_SELECT }) : null;
        return json({ data: row ? [vehicleShape(row)] : [], nextCursor: null });
    }

    const rows = await caller.db.vehicle.findMany({
        where: {
            ...(plate ? { plate: { equals: plate.trim(), mode: "insensitive" as const } } : {}),
            ...(customerId ? { customerId } : {}),
            ...(url.searchParams.get("includeArchived") === "true" ? {} : { archivedAt: null }),
        },
        orderBy: { id: "asc" },
        select: VEHICLE_SELECT,
        ...cursorArgs(cursor, limit),
    });
    const { data, nextCursor } = page(rows, limit);
    return json({ data: data.map(vehicleShape), nextCursor });
});

const createSchema = z.object({
    plate: z.string({ error: "A registration is needed." }).trim().min(1, "A registration is needed."),
    make: z.string({ error: "A make is needed." }).trim().min(1, "A make is needed."),
    model: z.string({ error: "A model is needed." }).trim().min(1, "A model is needed."),
    customerId: z.string().trim().min(1).optional(),
    year: z.number().int().min(1900).max(2100).optional(),
    colour: z.string().trim().optional(),
    vin: z.string().trim().optional(),
    odometer: z.number().int().min(0).optional(),
    externalId: z.string().trim().min(1).max(200).optional(),
});

export const POST = withKey("WRITE", async (caller, req) => {
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return fail("invalid_request", issue?.message ?? "That request could not be read.", { field: issue?.path.join(".") });
    }
    const input = parsed.data;

    if (input.externalId) {
        const existing = await lookupByExternalId(caller, "vehicle", input.externalId);
        const row = existing ? await caller.db.vehicle.findUnique({ where: { id: existing }, select: VEHICLE_SELECT }) : null;
        if (row) return json({ data: vehicleShape(row), created: false });
    }

    // A vehicle hung on a customer who is not this workshop's would be a leak, so it is checked rather than trusted.
    if (input.customerId) {
        const owner = await caller.db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
        if (!owner) return fail("invalid_request", "No customer with that id.", { field: "customerId" });
    }

    const created = await createLinked(caller, "vehicle", input.externalId, (tx) =>
        tx.vehicle.create({
            data: {
                tenantId: caller.tenant.id,
                plate: input.plate,
                make: input.make,
                model: input.model,
                customerId: input.customerId ?? null,
                year: input.year ?? null,
                colour: input.colour || null,
                vin: input.vin || null,
                odometer: input.odometer ?? null,
            },
            select: VEHICLE_SELECT,
        }),
    );
    return json({ data: vehicleShape(created), created: true }, { status: 201 });
});
