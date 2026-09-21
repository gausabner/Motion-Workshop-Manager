import { withKey } from "@/lib/api/auth";
import { cursorArgs, json, page, paging } from "@/lib/api/http";
import { PRODUCT_SELECT, productShape } from "@/lib/api/shapes";

/**
 * The price list and what is on the shelf. `?itemCode=` for a single lookup,
 * `?q=` for a description search, `?updatedSince=` for a sync.
 */
export const GET = withKey("READ", async (caller, req) => {
    const url = new URL(req.url);
    const { limit, cursor } = paging(url);
    const itemCode = url.searchParams.get("itemCode");
    const q = url.searchParams.get("q");
    const updatedSince = url.searchParams.get("updatedSince");
    const since = updatedSince ? new Date(updatedSince) : null;

    const rows = await caller.db.product.findMany({
        where: {
            ...(itemCode ? { itemCode: { equals: itemCode.trim(), mode: "insensitive" as const } } : {}),
            ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}),
            ...(since && !Number.isNaN(since.getTime()) ? { updatedAt: { gte: since } } : {}),
            ...(url.searchParams.get("includeArchived") === "true" ? {} : { archivedAt: null }),
        },
        orderBy: { id: "asc" },
        select: PRODUCT_SELECT,
        ...cursorArgs(cursor, limit),
    });
    const { data, nextCursor } = page(rows, limit);
    return json({ data: data.map(productShape), nextCursor });
});
