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
import type { PaymentDirection } from "@prisma/client";

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
 * Start a receipt or a refund. Seeding it from a document is the common path —
 * the counter presses Take payment on an invoice, or Refund on a credit note,
 * and expects that document already filled in at its full outstanding, which is
 * what the benchmark does.
 */
async function startPayment(slug: string, direction: PaymentDirection, seed?: { customerId?: string; documentId?: string }): Promise<never> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, membership, user } = ctx;

    let customerId = seed?.customerId ?? null;
    let seedItem: OpenItem | undefined;
    if (seed?.documentId) {
        const doc = await db.document.findUnique({ where: { id: seed.documentId }, select: { customerId: true } });
        if (doc?.customerId) {
            customerId = doc.customerId;
            const open = (await getOpenItems(db, customerId)).find((i) => i.id === seed.documentId);
            // A receipt settles what is owed; a refund only ever hands a credit back.
            if (open && (direction === "REFUND" ? open.outstanding < 0 : open.outstanding > 0)) seedItem = open;
        }
    }

    const created = await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
            data: { tenantId: tenant.id, customerId, direction, state: "DRAFT", takenById: membership.id, amount: 0, postDate: businessToday(tenant.timezone) },
            select: { id: true },
        });
        if (seedItem) {
            await tx.paymentAllocation.create({ data: { tenantId: tenant.id, paymentId: payment.id, documentId: seedItem.id, amount: seedItem.outstanding } });
            // The tender is stored too, not merely suggested on screen. Seeding
            // only the allocation left the receipt looking complete while the
            // books held one side of it, and posting it without touching a field
            // failed on what the database actually contained — on the commonest
            // path there is: Take payment, then Post receipt.
            const method = await tx.paymentMethod.findFirst({
                where: { active: true },
                orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
                select: { id: true },
            });
            if (method) {
                await tx.paymentTender.create({
                    data: { tenantId: tenant.id, paymentId: payment.id, methodId: method.id, amount: seedItem.outstanding },
                });
            }
        }
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Payment", entityId: payment.id, action: "CREATED", diff: { direction } } });
        return payment;
    });

    revalidateMoney(slug);
    redirect(editorPath(slug, created.id));
}

export async function createPayment(slug: string, seed?: { customerId?: string; documentId?: string }): Promise<void> {
    await startPayment(slug, "RECEIPT", seed);
}

export async function createRefund(slug: string, seed?: { customerId?: string; documentId?: string }): Promise<void> {
    await startPayment(slug, "REFUND", seed);
}

export async function savePayment(slug: string, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, user } = ctx;

    const existing = await db.payment.findUnique({ where: { id }, select: { state: true, direction: true } });
    if (!existing) return { ok: false, message: "Receipt not found." };
    if (existing.state !== "DRAFT") return { ok: false, message: `This ${existing.direction === "REFUND" ? "refund" : "receipt"} has been posted and can no longer be edited.` };

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
    // The editor works in magnitudes; which way the money goes is decided here,
    // once, from the payment's own direction.
    const sign = existing.direction === "REFUND" ? -1 : 1;
    const tenders = d.tenders
        .map((t) => {
            const amount = round2(sign * Math.abs(t.amount));
            const handed = t.tendered == null ? null : round2(sign * Math.abs(t.tendered));
            return { ...t, amount, tendered: handed !== null && Math.abs(handed) > Math.abs(amount) ? handed : null };
        })
        .filter((t) => t.amount !== 0);
    const amount = round2(tenders.reduce((sum, t) => sum + t.amount, 0));

    await db.$transaction(async (tx) => {
        await tx.payment.update({
            where: { id },
            data: { customerId: d.customerId, postDate: d.postDate ?? undefined, note: d.note ?? null, amount },
        });
        // Tenders are updated in place rather than replaced, because a row can
        // own an EFT proof of payment and recreating it would orphan the file.
        const kept = tenders.map((t) => t.id).filter((v): v is string => !!v);
        await tx.paymentTender.deleteMany({ where: { paymentId: id, ...(kept.length ? { id: { notIn: kept } } : {}) } });
        for (const [index, t] of tenders.entries()) {
            const data = { methodId: t.methodId, amount: t.amount, tendered: t.tendered, reference: t.reference?.trim() || null, sortOrder: index };
            // Scoped by paymentId as well as id, so an id from another receipt cannot be steered into this one.
            const updated = t.id ? await tx.paymentTender.updateMany({ where: { id: t.id, paymentId: id }, data }) : { count: 0 };
            if (!updated.count) await tx.paymentTender.create({ data: { ...data, tenantId: tenant.id, paymentId: id } });
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
/**
 * `redirect()` works by throwing, so a catch around a transaction would swallow
 * it. Recognised by its digest rather than by importing Next's internals, which
 * move between versions.
 */
function isRedirect(error: unknown): boolean {
    return typeof (error as { digest?: unknown })?.digest === "string" && String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT");
}

export async function processPayment(slug: string, id: string): Promise<void> {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "payments:take");
    const { db, tenant, membership, user } = ctx;

    try {
        await db.$transaction(async (tx) => {
            const { number } = await postPayment(tx, tenant.id, membership.id, id);
            await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Payment", entityId: id, action: "PROCESSED", diff: { number } } });
        });
    } catch (error) {
        // Whatever is wrong with a receipt, a person at a counter should read it
        // on the receipt — not a page saying a server-side exception occurred.
        if (isRedirect(error)) throw error;
        const why = error instanceof Error ? error.message : "That receipt could not be posted.";
        revalidateMoney(slug, id);
        redirect(`${editorPath(slug, id)}?problem=${encodeURIComponent(why)}`);
    }

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
