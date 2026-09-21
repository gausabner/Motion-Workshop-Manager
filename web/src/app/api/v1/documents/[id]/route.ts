import { authenticate } from "@/lib/api/auth";
import { fail, json } from "@/lib/api/http";
import { DOCUMENT_SELECT, documentShape, LINE_SELECT } from "@/lib/api/shapes";
import { PROCESSED_ALLOCATIONS } from "@/lib/documents/queries";
import { amountDue, round2 } from "@/lib/documents/totals";

/** The whole document: header, lines, and what is still owed on it. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
    const caller = await authenticate(req, "READ");
    if (caller instanceof Response) return caller;
    const { id } = await ctx.params;

    const doc = await caller.db.document.findUnique({
        where: { id },
        select: { ...DOCUMENT_SELECT, allocations: PROCESSED_ALLOCATIONS, lines: { orderBy: { sortOrder: "asc" }, select: LINE_SELECT } },
    });
    if (!doc) return fail("not_found", "No document with that id.");

    const { allocations, lines, ...rest } = doc;
    const paid = round2(allocations.reduce((sum, a) => sum + a.amount.toNumber(), 0));
    return json({ data: documentShape(rest, { paid, due: amountDue(rest.total.toNumber(), paid), lines }) });
}
