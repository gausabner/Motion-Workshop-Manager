"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { businessToday } from "@/lib/tenant/today";
import { getPayment, postPayment, reversePayment, savePayment, type PaymentInput } from "@/lib/purchasing/payments";

const base = (slug: string) => `/${slug}/dashboard/purchasing`;
const paymentPath = (slug: string, id: string) => `${base(slug)}/payments/${id}`;

const schema = z.object({
    postDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-20"),
    reference: z.string().trim().max(60).nullish(),
    methodId: z.union([z.literal(""), z.string().max(40)]).nullish().transform((v) => (v ? v : null)),
    note: z.string().trim().max(500).nullish(),
    amount: z.coerce.number().min(0).max(99_999_999),
    allocations: z.array(z.object({ supplierInvoiceId: z.string().min(1).max(40), amount: z.coerce.number().min(0).max(99_999_999) })),
});

/** Paying suppliers is money out: the same people who may take money may pay it. */
async function payer(slug: string) {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    return ctx;
}

export async function newSupplierPaymentAction(slug: string): Promise<void> {
    const { db, tenant, membership } = await payer(slug);
    const id = await db.$transaction((tx) =>
        savePayment(tx, tenant, membership.id, null, { postDate: businessToday(tenant.timezone).toISOString().slice(0, 10), amount: 0, allocations: [] }),
    );
    redirect(paymentPath(slug, id));
}

export async function saveSupplierPaymentAction(slug: string, id: string, input: unknown): Promise<{ ok: boolean; message?: string }> {
    const { db, tenant, membership } = await payer(slug);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the payment" };
    try {
        await db.$transaction((tx) => savePayment(tx, tenant, membership.id, id, parsed.data as PaymentInput));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not saved" };
    }
    revalidatePath(paymentPath(slug, id));
    return { ok: true };
}

export async function postSupplierPaymentAction(slug: string, id: string, input: unknown): Promise<{ ok: boolean; message: string }> {
    const { db, tenant, membership } = await payer(slug);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the payment" };
    try {
        const result = await db.$transaction(async (tx) => {
            await savePayment(tx, tenant, membership.id, id, parsed.data as PaymentInput);
            return postPayment(tx, tenant.id, id);
        });
        revalidatePath(paymentPath(slug, id));
        revalidatePath(base(slug));
        return { ok: true, message: `Paid. ${result.number} recorded.` };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not posted" };
    }
}

export async function reverseSupplierPaymentAction(slug: string, id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await payer(slug);
    if (!reason.trim()) return { ok: false, message: "Give a reason." };
    try {
        await db.$transaction((tx) => reversePayment(tx, id, reason));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not reversed" };
    }
    revalidatePath(paymentPath(slug, id));
    revalidatePath(base(slug));
    return { ok: true };
}

/** Pay a whole supplier account from their page: a draft with every open invoice on it. */
export async function payAllForSupplierAction(slug: string, supplierId: string): Promise<void> {
    const { db, tenant, membership } = await payer(slug);
    const { openSupplierInvoices } = await import("@/lib/purchasing/payments");
    const open = await openSupplierInvoices(db, supplierId);
    if (open.length === 0) throw new Error("Nothing is owed to this supplier.");
    const id = await db.$transaction((tx) =>
        savePayment(tx, tenant, membership.id, null, {
            postDate: businessToday(tenant.timezone).toISOString().slice(0, 10),
            amount: open.reduce((total, i) => total + i.outstanding, 0),
            allocations: open.map((i) => ({ supplierInvoiceId: i.id, amount: i.outstanding })),
        }),
    );
    redirect(paymentPath(slug, id));
}

export async function paymentForEditing(slug: string, id: string) {
    const { db } = await payer(slug);
    return getPayment(db, id);
}
