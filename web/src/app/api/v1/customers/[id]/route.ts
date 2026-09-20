import { authenticate } from "@/lib/api/auth";
import { fail, json } from "@/lib/api/http";
import { CUSTOMER_SELECT, customerShape, VEHICLE_SELECT, vehicleShape } from "@/lib/api/shapes";

/**
 * One customer, with their vehicles alongside. Their API needed nineteen
 * requests to open a customer screen because each accordion section is its own
 * endpoint; the two things anybody actually wants together come together here.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
    const caller = await authenticate(req, "READ");
    if (caller instanceof Response) return caller;
    const { id } = await ctx.params;

    const customer = await caller.db.customer.findUnique({ where: { id }, select: CUSTOMER_SELECT });
    if (!customer) return fail("not_found", "No customer with that id.");

    const vehicles = await caller.db.vehicle.findMany({
        where: { customerId: id, archivedAt: null },
        orderBy: { plate: "asc" },
        select: VEHICLE_SELECT,
    });
    return json({ data: { ...customerShape(customer), vehicles: vehicles.map(vehicleShape) } });
}
