"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { type ActionState, bool, fromZod, str } from "@/lib/forms";
import { customerSchema } from "@/lib/customers/schema";

function read(fd: FormData) {
    const s = (n: string) => str(fd, n);
    return {
        firstName: s("firstName"), lastName: s("lastName"), isBusiness: bool(fd, "isBusiness"),
        businessNumber: s("businessNumber"), vatNumber: s("vatNumber"),
        mobile: s("mobile"), phone: s("phone"), email: s("email") ?? "", fax: s("fax"), web: s("web"),
        preferredContact: s("preferredContact"),
        streetAddress1: s("streetAddress1"), streetAddress2: s("streetAddress2"), streetSuburb: s("streetSuburb"), streetCity: s("streetCity"), streetRegion: s("streetRegion"), streetCountry: s("streetCountry"), streetPostcode: s("streetPostcode"),
        postalAddress1: s("postalAddress1"), postalAddress2: s("postalAddress2"), postalSuburb: s("postalSuburb"), postalCity: s("postalCity"), postalRegion: s("postalRegion"), postalCountry: s("postalCountry"), postalPostcode: s("postalPostcode"),
        hourlyRate: s("hourlyRate"), discountPercent: s("discountPercent"), markupPercent: s("markupPercent"), priceType: s("priceType"),
        paymentTermsDays: s("paymentTermsDays"), creditLimit: s("creditLimit"), vatExempt: bool(fd, "vatExempt"),
        customerSourceId: s("customerSourceId"), note: s("note"),
    };
}

export async function saveCustomer(slug: string, id: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { db, membership, user, tenant } = await requireTenant(slug);
    assertCan(membership, "customers:write");
    const parsed = customerSchema.safeParse(read(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const data = parsed.data;

    let savedId = id;
    if (id) {
        const existing = await db.customer.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return { ok: false, message: "Customer not found." };
        await db.customer.update({ where: { id }, data });
        await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Customer", entityId: id, action: "UPDATED" } });
    } else {
        const created = await db.customer.create({ data: { ...data, tenantId: tenant.id } });
        savedId = created.id;
        await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Customer", entityId: created.id, action: "CREATED" } });
    }
    revalidatePath(`/${tenant.slug}/dashboard/customers`);
    redirect(`/${tenant.slug}/dashboard/customers/${savedId}?saved=1`);
}

export async function setCustomerArchived(slug: string, id: string, archived: boolean): Promise<void> {
    const { db, membership, user, tenant } = await requireTenant(slug);
    assertCan(membership, "customers:write");
    await db.customer.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await db.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Customer", entityId: id, action: archived ? "ARCHIVED" : "UNARCHIVED" } });
    revalidatePath(`/${tenant.slug}/dashboard/customers`);
    redirect(`/${tenant.slug}/dashboard/customers${archived ? "" : `/${id}`}`);
}
