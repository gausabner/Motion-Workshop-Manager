"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { fromZod, str, type ActionState } from "@/lib/forms";

const optional = (max: number) => z.string().trim().max(max).optional();

const supplierSchema = z.object({
    companyName: z.string().trim().min(2, "Give the supplier a name").max(120),
    accountNumber: optional(40),
    vatNumber: optional(40),
    address1: optional(120),
    suburb: optional(80),
    city: optional(80),
    postcode: optional(20),
    phone: optional(40),
    mobile: optional(40),
    email: z.union([z.literal(""), z.email("That email does not look right")]).optional(),
    web: optional(120),
    paymentTermsDays: z.union([z.literal(""), z.coerce.number().int().min(0).max(365)]).optional().transform((v) => (v === "" || v === undefined ? null : Number(v))),
    note: optional(500),
});

const path = (slug: string, id?: string) => `/${slug}/dashboard/suppliers${id ? `/${id}` : ""}`;

export async function saveSupplier(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "products:write");
    const parsed = supplierSchema.safeParse(Object.fromEntries(
        ["companyName", "accountNumber", "vatNumber", "address1", "suburb", "city", "postcode", "phone", "mobile", "email", "web", "paymentTermsDays", "note"].map((k) => [k, str(formData, k) ?? ""]),
    ));
    if (!parsed.success) return fromZod(parsed.error);
    if (id) {
        await db.supplier.update({ where: { id }, data: parsed.data });
    } else {
        const created = await db.supplier.create({ data: { ...parsed.data, tenantId: tenant.id }, select: { id: true } });
        await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Supplier", entityId: created.id, action: "CREATED" } });
        revalidatePath(path(slug));
        redirect(path(slug, created.id));
    }
    revalidatePath(path(slug, id));
    revalidatePath(path(slug));
    return { ok: true, message: "Saved" };
}

export async function archiveSupplier(slug: string, id: string, archived: boolean): Promise<void> {
    const { db, membership } = await requireTenant(slug);
    assertCan(membership, "products:write");
    await db.supplier.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    revalidatePath(path(slug, id));
    revalidatePath(path(slug));
}
