import type { DocumentState, DocumentType } from "@prisma/client";
import { withKey } from "@/lib/api/auth";
import { cursorArgs, fail, json, page, paging } from "@/lib/api/http";
import { DOCUMENT_SELECT, documentShape } from "@/lib/api/shapes";
import { PROCESSED_ALLOCATIONS } from "@/lib/documents/queries";
import { amountDue, round2 } from "@/lib/documents/totals";

const TYPES: DocumentType[] = ["QUOTE", "BOOKING", "JOB_CARD", "INVOICE", "CASH_SALE", "CREDIT"];
const STATES: DocumentState[] = ["DRAFT", "PROCESSED", "CLOSED", "VOID"];

/**
 * Quotes, bookings, job cards, invoices and credit notes are one table here
 * and one endpoint here, because in the workshop they are one thing at
 * different stages of its life.
 *
 * `paid` and `due` come from allocations on every read. We never store them,
 * and the benchmark shows why: their settled supplier invoices still carry a
 * stale `balance_due`, so their own API reports money owed that is not.
 */
export const GET = withKey("READ", async (caller, req) => {
    const url = new URL(req.url);
    const { limit, cursor } = paging(url);

    const type = url.searchParams.get("type")?.toUpperCase();
    if (type && !TYPES.includes(type as DocumentType)) {
        return fail("invalid_request", `\`type\` must be one of ${TYPES.join(", ")}.`, { field: "type" });
    }
    const state = url.searchParams.get("state")?.toUpperCase();
    if (state && !STATES.includes(state as DocumentState)) {
        return fail("invalid_request", `\`state\` must be one of ${STATES.join(", ")}.`, { field: "state" });
    }

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    for (const [name, value] of [["from", from], ["to", to]] as const) {
        if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail("invalid_request", `\`${name}\` must be a date like 2026-09-20.`, { field: name });
    }

    const rows = await caller.db.document.findMany({
        where: {
            ...(type ? { type: type as DocumentType } : {}),
            ...(state ? { state: state as DocumentState } : {}),
            ...(url.searchParams.get("customerId") ? { customerId: url.searchParams.get("customerId")! } : {}),
            ...(url.searchParams.get("vehicleId") ? { vehicleId: url.searchParams.get("vehicleId")! } : {}),
            ...(from || to
                ? { postDate: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}) } }
                : {}),
        },
        orderBy: { id: "asc" },
        select: { ...DOCUMENT_SELECT, allocations: PROCESSED_ALLOCATIONS },
        ...cursorArgs(cursor, limit),
    });

    const { data, nextCursor } = page(rows, limit);
    return json({
        data: data.map(({ allocations, ...d }) => {
            const paid = round2(allocations.reduce((sum, a) => sum + a.amount.toNumber(), 0));
            return documentShape(d, { paid, due: amountDue(d.total.toNumber(), paid) });
        }),
        nextCursor,
    });
});
