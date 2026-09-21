import { z } from "zod";
import { withKey } from "@/lib/api/auth";
import { cursorArgs, fail, json, page, paging } from "@/lib/api/http";
import { CUSTOMER_SELECT, customerShape } from "@/lib/api/shapes";
import { createLinked, lookupByExternalId } from "@/lib/api/external";

/**
 * `?updatedSince=` is what a nightly sync uses: ask for what changed, not for
 * everything. `?externalId=` finds the record by the *caller's* own id, so an
 * integration never has to store ours.
 */
export const GET = withKey("READ", async (caller, req) => {
    const url = new URL(req.url);
    const { limit, cursor } = paging(url);
    const externalId = url.searchParams.get("externalId");
    const updatedSince = url.searchParams.get("updatedSince");

    if (externalId) {
        const id = await lookupByExternalId(caller, "customer", externalId);
        if (!id) return json({ data: [], nextCursor: null });
        const row = await caller.db.customer.findUnique({ where: { id }, select: CUSTOMER_SELECT });
        return json({ data: row ? [customerShape(row)] : [], nextCursor: null });
    }

    let since: Date | undefined;
    if (updatedSince) {
        const parsed = new Date(updatedSince);
        if (Number.isNaN(parsed.getTime())) return fail("invalid_request", "`updatedSince` must be a date.", { field: "updatedSince" });
        since = parsed;
    }

    const rows = await caller.db.customer.findMany({
        where: { ...(since ? { updatedAt: { gte: since } } : {}), ...(url.searchParams.get("includeArchived") === "true" ? {} : { archivedAt: null }) },
        orderBy: { id: "asc" },
        select: CUSTOMER_SELECT,
        ...cursorArgs(cursor, limit),
    });
    const { data, nextCursor } = page(rows, limit);
    return json({ data: data.map(customerShape), nextCursor });
});

const createSchema = z.object({
    firstName: z.string({ error: "A first name is needed." }).trim().min(1, "A first name is needed."),
    lastName: z.string().trim().default(""),
    isBusiness: z.boolean().optional(),
    email: z.string().trim().email("That email does not look right.").optional().or(z.literal("")),
    mobile: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    vatNumber: z.string().trim().optional(),
    address: z.object({ line1: z.string().optional(), city: z.string().optional(), region: z.string().optional() }).optional(),
    /** The caller's own id. Sending it twice returns the same customer rather than making a second one. */
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
        const existing = await lookupByExternalId(caller, "customer", input.externalId);
        if (existing) {
            const row = await caller.db.customer.findUnique({ where: { id: existing }, select: CUSTOMER_SELECT });
            if (row) return json({ data: customerShape(row), created: false });
        }
    }

    const created = await createLinked(caller, "customer", input.externalId, (tx) =>
        tx.customer.create({
            data: {
                tenantId: caller.tenant.id,
                firstName: input.firstName,
                lastName: input.lastName ?? "",
                isBusiness: input.isBusiness ?? false,
                email: input.email || null,
                mobile: input.mobile || null,
                phone: input.phone || null,
                vatNumber: input.vatNumber || null,
                streetAddress1: input.address?.line1 || null,
                streetCity: input.address?.city || null,
                streetRegion: input.address?.region || null,
            },
            select: CUSTOMER_SELECT,
        }),
    );
    return json({ data: customerShape(created), created: true }, { status: 201 });
});
