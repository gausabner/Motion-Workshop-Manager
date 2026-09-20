"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { businessToday } from "@/lib/tenant/today";
import { processInvoice, receiptFromOrder, saveInvoice, saveOrder, setOrderState, voidInvoice, type InvoiceInput, type OrderInput } from "@/lib/purchasing/service";

const base = (slug: string) => `/${slug}/dashboard/purchasing`;
const money = z.coerce.number().min(-99_999_999).max(99_999_999);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-09-20");
const optionalDay = z.union([z.literal(""), day]).nullish().transform((v) => (v ? v : null));
const optionalId = z.union([z.literal(""), z.string().max(40)]).nullish().transform((v) => (v ? v : null));

const orderSchema = z.object({
    supplierId: z.string().min(1, "Choose a supplier"),
    orderDate: day,
    dueDate: optionalDay,
    reference: z.string().trim().max(60).nullish(),
    note: z.string().trim().max(500).nullish(),
    lines: z.array(z.object({
        id: z.string().max(40).optional(),
        productId: optionalId,
        description: z.string().trim().max(200),
        quantity: z.coerce.number().min(0.01, "A line needs a quantity").max(999_999),
        unitCost: money,
        documentId: optionalId,
        dueDate: optionalDay,
        note: z.string().trim().max(200).nullish(),
    })).min(1, "Add at least one line"),
});

const invoiceSchema = z.object({
    supplierId: z.string().min(1, "Choose a supplier"),
    supplierNumber: z.string().trim().max(60),
    otherReference: z.string().trim().max(60).nullish(),
    postDate: day,
    dueDate: optionalDay,
    taxRate: z.coerce.number().min(0).max(100),
    pricesIncludeTax: z.boolean(),
    freight: money,
    note: z.string().trim().max(500).nullish(),
    lines: z.array(z.object({
        id: z.string().max(40).optional(),
        productId: optionalId,
        description: z.string().trim().max(200),
        quantity: z.coerce.number().min(-999_999).max(999_999),
        unitCost: money,
        taxExempt: z.boolean(),
        orderLineId: optionalId,
        documentId: optionalId,
        newSellPrice: z.union([z.literal(""), money]).nullish().transform((v) => (v === "" || v === null || v === undefined ? null : Number(v))),
        serialNumbers: z.string().trim().max(2000).nullish(),
        note: z.string().trim().max(200).nullish(),
    })).min(1, "Add at least one line"),
});

type Result = { ok: true; id: string; message?: string } | { ok: false; message: string };

async function buyer(slug: string) {
    const ctx = await requireTenant(slug);
    // Buying is stock work: the same people who may change products may order them.
    assertCan(ctx.membership, "products:write");
    return ctx;
}

export async function saveOrderAction(slug: string, id: string | null, input: unknown): Promise<Result> {
    const { db, tenant, membership } = await buyer(slug);
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the order" };
    try {
        const orderId = await db.$transaction((tx) => saveOrder(tx, tenant, membership.id, id, parsed.data as OrderInput));
        revalidatePath(base(slug));
        revalidatePath(`${base(slug)}/orders/${orderId}`);
        return { ok: true, id: orderId, message: "Saved" };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The order was not saved" };
    }
}

export async function setOrderStateAction(slug: string, id: string, state: "ORDERED" | "CANCELLED" | "SUGGESTED"): Promise<{ ok: boolean; message?: string }> {
    const { db } = await buyer(slug);
    try {
        await db.$transaction((tx) => setOrderState(tx, id, state));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not changed" };
    }
    revalidatePath(`${base(slug)}/orders/${id}`);
    revalidatePath(base(slug));
    return { ok: true };
}

/** Start the receipt from an order, carrying what is still outstanding. */
export async function receiveOrderAction(slug: string, orderId: string): Promise<void> {
    const { db, tenant, membership } = await buyer(slug);
    const invoiceId = await db.$transaction((tx) => receiptFromOrder(tx, tenant, membership.id, orderId, businessToday(tenant.timezone)));
    revalidatePath(base(slug));
    redirect(`${base(slug)}/invoices/${invoiceId}`);
}

export async function newSupplierInvoiceAction(slug: string): Promise<void> {
    const { db, tenant, membership } = await buyer(slug);
    const supplier = await db.supplier.findFirst({ where: { archivedAt: null }, orderBy: { companyName: "asc" }, select: { id: true } });
    if (!supplier) throw new Error("Add a supplier first.");
    const invoiceId = await db.$transaction((tx) =>
        saveInvoice(tx, tenant, membership.id, null, {
            supplierId: supplier.id, supplierNumber: "", postDate: businessToday(tenant.timezone).toISOString().slice(0, 10),
            taxRate: tenant.purchaseTaxRate.toNumber(), pricesIncludeTax: false, freight: 0,
            lines: [{ productId: null, description: "", quantity: 1, unitCost: 0, taxExempt: false, orderLineId: null, documentId: null, newSellPrice: null, serialNumbers: null }],
        } satisfies InvoiceInput),
    );
    redirect(`${base(slug)}/invoices/${invoiceId}`);
}

export async function saveInvoiceAction(slug: string, id: string | null, input: unknown): Promise<Result> {
    const { db, tenant, membership } = await buyer(slug);
    const parsed = invoiceSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the invoice" };
    try {
        const invoiceId = await db.$transaction((tx) => saveInvoice(tx, tenant, membership.id, id, parsed.data as InvoiceInput));
        revalidatePath(`${base(slug)}/invoices/${invoiceId}`);
        revalidatePath(base(slug));
        return { ok: true, id: invoiceId, message: "Saved" };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The invoice was not saved" };
    }
}

export async function processInvoiceAction(slug: string, id: string): Promise<{ ok: boolean; message: string }> {
    const { db, tenant, membership, user } = await buyer(slug);
    try {
        const result = await db.$transaction((tx) => processInvoice(tx, tenant, { membershipId: membership.id, userId: user.id }, id));
        revalidatePath(`${base(slug)}/invoices/${id}`);
        revalidatePath(base(slug));
        revalidatePath(`/${slug}/dashboard/products`);
        const repriced = result.repriced > 0 ? `, and ${result.repriced} sell ${result.repriced === 1 ? "price" : "prices"} updated` : "";
        return { ok: true, message: `Received. ${result.received} ${result.received === 1 ? "product is" : "products are"} on the shelf${repriced}.` };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not processed" };
    }
}

export async function voidInvoiceAction(slug: string, id: string, reason: string): Promise<{ ok: boolean; message?: string }> {
    const { db, tenant, membership, user } = await buyer(slug);
    if (!reason.trim()) return { ok: false, message: "Give a reason." };
    try {
        await db.$transaction((tx) => voidInvoice(tx, tenant, { membershipId: membership.id, userId: user.id }, id, reason));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not voided" };
    }
    revalidatePath(`${base(slug)}/invoices/${id}`);
    revalidatePath(`/${slug}/dashboard/products`);
    return { ok: true };
}
