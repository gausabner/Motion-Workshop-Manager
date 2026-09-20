"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { bool, fromZod, str, type ActionState } from "@/lib/forms";
import { adjustSchema, bundleItemsSchema, productSchema } from "@/lib/products/schema";
import { applyMatrixToProduct } from "@/lib/products/matrix-service";
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
        priceMatrixId: str(formData, "priceMatrixId") ?? "",
        costExTax: n("costExTax"),
        retailPrice: n("retailPrice"),
        price2: n("price2"),
        price3: n("price3"),
        price4: n("price4"),
        minQty: n("minQty"),
        maxQty: n("maxQty"),
        defaultLabourQty: str(formData, "defaultLabourQty") ?? "",
        isBundle: bool(formData, "isBundle"),
        bundlePricing: str(formData, "bundlePricing") ?? "FIXED",
        bundlePrinting: str(formData, "bundlePrinting") ?? "COMPONENTS",
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
            // On a matrix, the price follows the cost — unless this save changed the price itself.
            const before = await db.product.findUnique({ where: { id }, select: { retailPrice: true } });
            if (parsed.data.priceMatrixId && before && before.retailPrice.toNumber() === parsed.data.retailPrice) {
                await db.$transaction((tx) => applyMatrixToProduct(tx, id));
            }
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

/** What is inside a bundle. Saved whole, so removing a component is just leaving it out. */
export async function saveBundleItems(slug: string, bundleId: string, items: unknown): Promise<{ ok: boolean; message: string }> {
    const { db, tenant, membership } = await requireTenant(slug);
    assertCan(membership, "products:write");
    const parsed = bundleItemsSchema.safeParse(items);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the components" };
    if (parsed.data.some((i) => i.componentId === bundleId)) return { ok: false, message: "A bundle cannot contain itself." };

    const ids = parsed.data.map((i) => i.componentId);
    const components = ids.length ? await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, isBundle: true, description: true } }) : [];
    if (components.length !== new Set(ids).size) return { ok: false, message: "One of those products is no longer there." };
    // One level only: a bundle inside a bundle makes stock and margin very hard to follow.
    const nested = components.find((c) => c.isBundle);
    if (nested) return { ok: false, message: `${nested.description} is itself a bundle, and a bundle cannot go inside another.` };

    await db.$transaction(async (tx) => {
        await tx.bundleItem.deleteMany({ where: { bundleId } });
        for (const [index, item] of parsed.data.entries()) {
            await tx.bundleItem.create({ data: { tenantId: tenant.id, bundleId, componentId: item.componentId, quantity: item.quantity, sortOrder: index } });
        }
        await tx.product.update({ where: { id: bundleId }, data: { isBundle: parsed.data.length > 0 } });
    });
    revalidatePath(path(slug, bundleId));
    return { ok: true, message: parsed.data.length === 0 ? "Emptied; this is no longer a bundle." : `Saved. ${parsed.data.length} ${parsed.data.length === 1 ? "item" : "items"} in this bundle.` };
}
