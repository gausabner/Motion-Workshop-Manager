"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { bool, fromZod, str, type ActionState } from "@/lib/forms";
import { adjustSchema, productSchema } from "@/lib/products/schema";
import { adjustStock, recount } from "@/lib/stock/ledger";

const path = (slug: string, id?: string) => `/${slug}/dashboard/products${id ? `/${id}` : ""}`;

function read(formData: FormData) {
    const n = (name: string) => str(formData, name) ?? 0;
    return {
        itemCode: str(formData, "itemCode"),
        description: str(formData, "description"),
        description2: str(formData, "description2"),
        type: str(formData, "type") ?? "STOCK",
        isService: bool(formData, "isService"),
        vatExempt: bool(formData, "vatExempt"),
        dontUpdateQty: bool(formData, "dontUpdateQty"),
        brand: str(formData, "brand"),
        location: str(formData, "location"),
        comment: str(formData, "comment"),
        jobCardComment: str(formData, "jobCardComment"),
        groupId: str(formData, "groupId") ?? "",
        categoryId: str(formData, "categoryId") ?? "",
        supplierId: str(formData, "supplierId") ?? "",
        costExTax: n("costExTax"),
        retailPrice: n("retailPrice"),
        price2: n("price2"),
        price3: n("price3"),
        price4: n("price4"),
        minQty: n("minQty"),
        maxQty: n("maxQty"),
        defaultLabourQty: str(formData, "defaultLabourQty") ?? "",
    };
}

export async function saveProduct(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, user, membership } = await requireTenant(slug);
    assertCan(membership, "products:write");
    const parsed = productSchema.safeParse(read(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const data = { ...parsed.data, costIncTax: 0 };

    try {
        if (id) {
            await db.product.update({ where: { id }, data });
            await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Product", entityId: id, action: "UPDATED" } });
        } else {
            const created = await db.product.create({ data: { ...data, tenantId: tenant.id }, select: { id: true } });
            await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Product", entityId: created.id, action: "CREATED" } });
            revalidatePath(path(slug));
            redirect(`${path(slug, created.id)}?saved=1`);
        }
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { ok: false, errors: { itemCode: ["Another product already has that code"] } };
        }
        throw error;
    }
    revalidatePath(path(slug, id!));
    revalidatePath(path(slug));
    return { ok: true, message: "Saved" };
}

export async function archiveProduct(slug: string, id: string, archived: boolean): Promise<void> {
    const { db, membership } = await requireTenant(slug);
    assertCan(membership, "products:write");
    await db.product.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    revalidatePath(path(slug, id));
    revalidatePath(path(slug));
}

/** Book stock in or out by hand — a delivery, a write-off, a shelf count. */
export async function adjustStockAction(slug: string, productId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, tenant, membership } = await requireTenant(slug);
    assertCan(membership, "products:write");
    const parsed = adjustSchema.safeParse({ quantity: str(formData, "quantity"), kind: str(formData, "kind") ?? "ADJUSTMENT", note: str(formData, "note") });
    if (!parsed.success) return fromZod(parsed.error);
    const onHand = await db.$transaction((tx) => adjustStock(tx, tenant.id, { productId, ...parsed.data, membershipId: membership.id }));
    revalidatePath(path(slug, productId));
    revalidatePath(path(slug));
    return { ok: true, message: `Stock on hand is now ${onHand}.` };
}

/** Rebuild the running total from the movements, for when someone suspects it. */
export async function recountAction(slug: string, productId: string): Promise<{ ok: boolean; message: string }> {
    const { db, membership } = await requireTenant(slug);
    assertCan(membership, "products:write");
    const { was, now } = await db.$transaction((tx) => recount(tx, productId));
    revalidatePath(path(slug, productId));
    return { ok: true, message: was === now ? `Checked: ${now} on hand, matching its movements.` : `Corrected from ${was} to ${now}, from its movements.` };
}
