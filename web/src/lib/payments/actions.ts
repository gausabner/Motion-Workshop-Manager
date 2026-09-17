"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant, type TenantContext } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { type ActionState, fromZod, str } from "@/lib/forms";
import { clampAllocation } from "@/lib/documents/settlement";
import { round2 } from "@/lib/documents/totals";
import { postPayment, reversePayment } from "@/lib/payments/posting";
import { businessToday } from "@/lib/tenant/today";
import { savePaymentSchema } from "@/lib/payments/schema";
import { getOpenItems } from "@/lib/payments/queries";
import type { OpenItem } from "@/lib/payments/allocation";

function editorPath(slug: string, id: string) {
    return `/${slug}/dashboard/payments/${id}`;
}

function revalidateMoney(slug: string, id?: string) {
    revalidatePath(`/${slug}/dashboard/payments`);
    revalidatePath(`/${slug}/dashboard/transactions`);
    if (id) revalidatePath(editorPath(slug, id));
}

/** What the receipt screen asks for when the customer changes. */
export async function openItemsFor(slug: string, customerId: string): Promise<OpenItem[]> {
    const { db, membership } = await requireTenant(slug);
    assertCan(membership, "payments:take");
    if (!customerId) return [];
    return getOpenItems(db, customerId);
}

/**
 * Start a receipt. Seeding it from an invoice is the common path — the counter
 * presses Take payment on the invoice and expects that invoice already filled
 * in at its full outstanding, which is what the benchmark does.
 */
export async function createPayment(slug: string, seed?: { customerId?: string; documentId?: string }): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, membership, user } = ctx;

    let customerId = seed?.customerId ?? null;
    let seedItem: OpenItem | undefined;
    if (seed?.documentId) {
        const doc = await db.document.findUnique({ where: { id: seed.documentId }, select: { customerId: true } });
        if (doc?.customerId) {
            customerId = doc.customerId;
            seedItem = (await getOpenItems(db, customerId)).find((i) => i.id === seed.documentId);
        }
    }

    const created = await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
            data: { tenantId: tenant.id, customerId, state: "DRAFT", takenById: membership.id, amount: 0, postDate: businessToday(tenant.timezone) },
            select: { id: true },
        });
        if (seedItem) {
            await tx.paymentAllocation.create({ data: { tenantId: tenant.id, paymentId: payment.id, documentId: seedItem.id, amount: seedItem.outstanding } });
        }
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Payment", entityId: payment.id, action: "CREATED" } });
        return payment;
    });

    revalidateMoney(slug);
    redirect(editorPath(slug, created.id));
}

export async function savePayment(slug: string, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, user } = ctx;

    const existing = await db.payment.findUnique({ where: { id }, select: { state: true } });
    if (!existing) return { ok: false, message: "Receipt not found." };
    if (existing.state !== "DRAFT") return { ok: false, message: "This receipt has been posted and can no longer be edited." };

    let tendersRaw: unknown = [];
    let allocationsRaw: unknown = [];
    try {
        tendersRaw = JSON.parse((formData.get("tenders") as string) || "[]");
        allocationsRaw = JSON.parse((formData.get("allocations") as string) || "[]");
    } catch {
        return { ok: false, message: "The tenders could not be read. Reload the page and try again." };
    }

    const parsed = savePaymentSchema.safeParse({
        customerId: str(formData, "customerId"),
        postDate: str(formData, "postDate"),
        note: str(formData, "note"),
        tenders: tendersRaw,
        allocations: allocationsRaw,
    });
    if (!parsed.success) return fromZod(parsed.error);
    const d = parsed.data;

    const customer = await db.customer.findUnique({ where: { id: d.customerId }, select: { id: true } });
    if (!customer) return { ok: false, errors: { customerId: ["Customer not found"] } };

    // Allocations are only ever accepted against this customer's own open items.
    const open = new Map((await getOpenItems(db, d.customerId)).map((i) => [i.id, i]));
    const allocations = d.allocations
        .map((a) => ({ documentId: a.documentId, amount: clampAllocation(open.get(a.documentId)?.outstanding ?? 0, a.amount) }))
        .filter((a) => a.amount !== 0);
    const tenders = d.tenders.filter((t) => round2(t.amount) !== 0);
    const amount = round2(tenders.reduce((sum, t) => sum + t.amount, 0));

    await db.$transaction(async (tx) => {
        await tx.payment.update({
            where: { id },
            data: { customerId: d.customerId, postDate: d.postDate ?? undefined, note: d.note ?? null, amount },
        });
        // Tenders and allocations are small and wholly owned by the receipt: replace them outright.
        await tx.paymentTender.deleteMany({ where: { paymentId: id } });
        for (const [index, t] of tenders.entries()) {
            await tx.paymentTender.create({
                data: { tenantId: tenant.id, paymentId: id, methodId: t.methodId, amount: round2(t.amount), reference: t.reference?.trim() || null, sortOrder: index },
            });
        }
        await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });
        for (const a of allocations) {
            await tx.paymentAllocation.create({ data: { tenantId: tenant.id, paymentId: id, documentId: a.documentId, amount: a.amount } });
        }
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Payment", entityId: id, action: "UPDATED" } });
    });

    revalidateMoney(slug, id);
    return { ok: true, message: "Saved" };
}

/**
 * Post the receipt: take a number, lock it, and move every document it touched.
 *
 * The outstanding of each document is read again inside the transaction, so a
 * receipt that was sitting open while somebody else settled the same invoice
 * fails here rather than double-paying it.
 */
/**
 * Post the receipt: take a number, lock it, and move every document it touched.
 * The rules themselves live in `posting.ts`; this is the shell around them.
 */
export async function processPayment(slug: string, id: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, membership, user } = ctx;

    await db.$transaction(async (tx) => {
        const { number } = await postPayment(tx, tenant.id, membership.id, id);
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Payment", entityId: id, action: "PROCESSED", diff: { number } } });
    });

    revalidateMoney(slug, id);
    redirect(`${editorPath(slug, id)}?posted=1`);
}

/** Reverse a posted receipt. The number stays so the sequence remains auditable. */
export async function voidPayment(slug: string, id: string, formData: FormData): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, user } = ctx;
    const reason = (formData.get("voidReason") as string | null)?.trim();
    if (!reason) throw new Error("A reason is required to void a receipt");

    await db.$transaction(async (tx) => {
        await reversePayment(tx, id, reason);
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Payment", entityId: id, action: "VOIDED", diff: { reason } } });
    });

    revalidateMoney(slug, id);
    redirect(editorPath(slug, id));
}

/** Discard an unposted receipt entirely — nothing has happened yet, so nothing is kept. */
export async function deleteDraftPayment(slug: string, id: string): Promise<void> {
    const ctx: TenantContext = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, user } = ctx;

    const payment = await db.payment.findUnique({ where: { id }, select: { state: true } });
    if (!payment) throw new Error("Receipt not found");
    if (payment.state !== "DRAFT") throw new Error("A posted receipt cannot be deleted — void it instead");

    await db.$transaction(async (tx) => {
        await tx.payment.delete({ where: { id } });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Payment", entityId: id, action: "DELETED" } });
    });

    revalidateMoney(slug);
    redirect(`/${slug}/dashboard/payments`);
}
