import { authenticate } from "@/lib/api/auth";
import { fail, json } from "@/lib/api/http";
import { DOCUMENT_SELECT, documentShape, VEHICLE_SELECT, vehicleShape } from "@/lib/api/shapes";

/** One vehicle and the last ten things done to it — the service history, which is what anybody asking about a car wants. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
    const caller = await authenticate(req, "READ");
    if (caller instanceof Response) return caller;
    const { id } = await ctx.params;

    const vehicle = await caller.db.vehicle.findUnique({ where: { id }, select: VEHICLE_SELECT });
    if (!vehicle) return fail("not_found", "No vehicle with that id.");

    const history = await caller.db.document.findMany({
        where: { vehicleId: id, state: { in: ["PROCESSED", "CLOSED"] }, type: { in: ["INVOICE", "CASH_SALE", "JOB_CARD"] } },
        orderBy: { postDate: "desc" },
        take: 10,
        select: DOCUMENT_SELECT,
    });
    return json({ data: { ...vehicleShape(vehicle), history: history.map((d) => documentShape(d)) } });
}
