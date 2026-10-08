"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma, type BillingPeriod, type SubscriptionInvoice, type TenantStatus } from "@prisma/client";
import { asStaff } from "@/lib/admin/platform";
import { sendActivationLetter, sendRestoredLetter, sendSuspensionLetter } from "@/lib/billing/registration";
import { sendInvoiceLetter, sendRenewalReceipt } from "@/lib/billing/renewal-letters";
import { addPeriod, anchorDayOf, billingDateFromInput, billingDay, periodStartFor, renewalRefusal, renewalRules, renewalStart } from "@/lib/billing/periods";
import { issueInvoice } from "@/lib/billing/invoices";
import { renderSubscriptionInvoicePdf } from "@/lib/pdf/subscription-invoice";
import { newReference } from "@/lib/billing/reference";
import { PLANS, withVat } from "@/lib/pricing/plans";

export type AdminActionState = { ok: boolean; message: string };

/**
 * What MOTION's staff can do to a workshop's standing, and nothing more.
 *
 * Every move is a guarded transition rather than a plain update: the `where`
 * names the state the workshop must currently be in, and the move only happens
 * if exactly one row matched. Two people approving the same deposit at once
 * produce one activation, one audit entry and one email — not two of each —
 * and a stale screen cannot undo what somebody else just did.
 *
 * Two of the moves record money: approving a registration and recording a
 * renewal. Each writes a `SubscriptionPayment` naming who confirmed it and the
 * period it bought, because "who said this was paid, and for when?" is the
 * question somebody will eventually ask — and issues its tax invoice in the
 * same transaction, so there is never one without the other.
 *
 * None of these touch a workshop's own data, and could not if they tried: the
 * staff exemption in the database covers the billing tables only.
 */

type Tx = Prisma.TransactionClient;
type Staff = { id: string };
type Letter = (() => Promise<void>) | null;
type Outcome = { ok: false; message: string } | { ok: true; message: string; slug: string; letter: Letter };

const WORKSHOP = {
    id: true,
    slug: true,
    name: true,
    status: true,
    subscription: {
        select: { id: true, reference: true, planName: true, priceAmount: true, period: true, status: true, startedAt: true, periodEndsAt: true },
    },
    memberships: {
        where: { group: "OWNER" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { email: true, firstName: true } } },
    },
} satisfies Prisma.TenantSelect;

type Workshop = Prisma.TenantGetPayload<{ select: typeof WORKSHOP }>;

const STALE = (name: string) => ({ ok: false as const, message: `${name} is no longer in a state where that applies — refresh to see where it stands.` });

/** Thrown inside the transaction to roll back a move that half-happened, and answered as STALE. */
class Stale extends Error {
    constructor(readonly workshopName: string) {
        super("stale");
    }
}

async function run(formData: FormData, fn: (tx: Tx, staff: Staff, w: Workshop, now: Date) => Promise<Outcome>): Promise<AdminActionState> {
    const tenantId = String(formData.get("tenantId") ?? "");
    if (!tenantId) return { ok: false, message: "No workshop was named." };

    let outcome: Outcome;
    try {
        outcome = await asStaff(async (tx, staff) => {
            const w = await tx.tenant.findUnique({ where: { id: tenantId }, select: WORKSHOP });
            if (!w) return { ok: false as const, message: "That workshop no longer exists." };
            return fn(tx, staff, w, new Date());
        });
    } catch (error) {
        if (error instanceof Stale) return STALE(error.workshopName);
        throw error;
    }
    if (!outcome.ok) return outcome;

    // The owner hears about every change to whether they can get in, after the
    // response. The move is already committed, so a failed send costs a letter,
    // not the approval.
    const { letter, slug } = outcome;
    if (letter) {
        after(() =>
            letter().catch((error: unknown) =>
                console.error("[admin] email could not be sent.", { workshop: slug, error: error instanceof Error ? error.message : String(error) }),
            ),
        );
    }
    // The layout, so a workshop's own page under /admin redraws too.
    revalidatePath("/admin", "layout");
    return { ok: true, message: outcome.message };
}

async function audit(tx: Tx, staff: Staff, w: Workshop, action: string, detail: Record<string, unknown>) {
    await tx.platformAuditEvent.create({
        data: {
            actorUserId: staff.id,
            action,
            tenantId: w.id,
            detail: {
                from: w.status,
                reference: w.subscription?.reference ?? null,
                plan: w.subscription?.planName ?? null,
                amountExclVat: w.subscription ? Number(w.subscription.priceAmount) : null,
                ...detail,
            } as Prisma.InputJsonObject,
        },
    });
}

const owner = (w: Workshop) => w.memberships[0]?.user ?? null;

/**
 * Money arrived: move the period on and keep the receipt.
 *
 * `expectedEnd` is the paid-up-to date the screen showed when the button was
 * pressed. The update only happens if it is still that date, so a double click
 * — or two people with the statement open — records one month, not two.
 */
async function recordPayment(tx: Tx, staff: Staff, w: Workshop, now: Date, opts: { first: boolean; expectedEnd: Date | null }) {
    const sub = w.subscription!;
    const start = opts.first ? now : renewalStart(w.status, sub.periodEndsAt, now);
    const continuing = !opts.first && sub.periodEndsAt !== null && start.getTime() === sub.periodEndsAt.getTime();
    const anchor = continuing && sub.startedAt ? anchorDayOf(sub.startedAt) : anchorDayOf(start);
    const end = addPeriod(start, sub.period, anchor);

    const claimed = await tx.subscription.updateMany({
        where: { id: sub.id, periodEndsAt: opts.expectedEnd },
        data: { status: "ACTIVE", periodEndsAt: end, ...(continuing ? {} : { startedAt: start }) },
    });
    if (claimed.count !== 1) return null;

    const price = Number(sub.priceAmount);
    const payment = await tx.subscriptionPayment.create({
        data: {
            tenantId: w.id,
            subscriptionId: sub.id,
            amountExclVat: price,
            amountInclVat: withVat(price),
            periodFrom: start,
            periodTo: end,
            confirmedById: staff.id,
        },
        select: { id: true },
    });
    const invoice = await issueInvoice(tx, payment.id, now);
    return { start, end, amountInclVat: withVat(price), invoice };
}

/** The invoice as a mail attachment. Rendered after the commit, from the issued row only. */
async function invoiceAttachment(invoice: SubscriptionInvoice) {
    return { number: invoice.number, attachment: { filename: `${invoice.number}.pdf`, content: await renderSubscriptionInvoicePdf(invoice), contentType: "application/pdf" } };
}

/**
 * Notes that the invoice reached the mail server. Runs after the response, so
 * it opens its own staff transaction; if the send failed this never runs, and
 * the workshop's page offers to send it again.
 */
async function markEmailed(invoiceId: string) {
    await asStaff((tx) => tx.subscriptionInvoice.update({ where: { id: invoiceId }, data: { emailedAt: new Date() } }));
}

function expectedEndFrom(formData: FormData): Date | null | "invalid" {
    const raw = String(formData.get("expectedEnd") ?? "");
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? "invalid" : d;
}

// ── a new registration, paid ─────────────────────────────────────────────────

export async function activateAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    return run(formData, async (tx, staff, w, now) => {
        // Refused rather than guessed at. With no plan there is no amount and
        // no reference, so there is nothing a payment could have been matched
        // against.
        if (!w.subscription) {
            return { ok: false, message: `${w.name} has not chosen a plan, so there is no amount to have been paid. They can choose one at /activate.` };
        }
        const moved = await tx.tenant.updateMany({ where: { id: w.id, status: "PENDING_PAYMENT" }, data: { status: "ACTIVE" } });
        if (moved.count !== 1) return STALE(w.name);

        const paid = await recordPayment(tx, staff, w, now, { first: true, expectedEnd: w.subscription.periodEndsAt });
        if (!paid) throw new Stale(w.name);
        await audit(tx, staff, w, "ACTIVATED", { to: "ACTIVE", paidUntil: paid.end.toISOString(), invoice: paid.invoice.number });

        const o = owner(w);
        return {
            ok: true,
            slug: w.slug,
            message: `${w.name}: switched on and paid up to ${billingDay(paid.end)}. Tax invoice ${paid.invoice.number} is on its way to the owner.`,
            letter: o
                ? async () => {
                      await sendActivationLetter({
                          to: o.email,
                          firstName: o.firstName,
                          workshopName: w.name,
                          slug: w.slug,
                          paidUntil: paid.end,
                          invoice: await invoiceAttachment(paid.invoice),
                      });
                      await markEmailed(paid.invoice.id);
                  }
                : null,
        };
    });
}

// ── a renewal, paid ──────────────────────────────────────────────────────────

export async function renewAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    const expectedEnd = expectedEndFrom(formData);
    if (expectedEnd === "invalid") return { ok: false, message: "The page was out of date. Refresh and try again." };
    // Sent only by the workshop's own page, which names the period an early payment buys.
    const early = formData.get("early") === "1";

    return run(formData, async (tx, staff, w, now) => {
        const sub = w.subscription;
        if (!sub || sub.status !== "ACTIVE" || !sub.periodEndsAt) {
            return { ok: false, message: `${w.name} has no dated subscription to renew. Set up its billing first.` };
        }
        const allowed: TenantStatus[] = ["ACTIVE", "PAST_DUE", "SUSPENDED"];
        if (!allowed.includes(w.status)) return STALE(w.name);

        // Lock the subscription first, so two presses arriving together are
        // checked one after the other rather than both finding no payment.
        await tx.$executeRaw`SELECT 1 FROM "Subscription" WHERE "id" = ${sub.id} FOR UPDATE`;
        const last = await tx.subscriptionPayment.findFirst({
            where: { tenantId: w.id },
            orderBy: { confirmedAt: "desc" },
            select: { confirmedAt: true, invoice: { select: { number: true } } },
        });
        const refusal = renewalRefusal({
            workshopName: w.name,
            tenantStatus: w.status,
            periodEndsAt: sub.periodEndsAt,
            early,
            lastPayment: last ? { confirmedAt: last.confirmedAt, invoiceNumber: last.invoice?.number ?? null } : null,
            now,
            rules: renewalRules(),
        });
        if (refusal) return { ok: false, message: refusal };

        const restored = w.status !== "ACTIVE";
        if (restored) {
            const moved = await tx.tenant.updateMany({ where: { id: w.id, status: w.status }, data: { status: "ACTIVE" } });
            if (moved.count !== 1) return STALE(w.name);
        }

        const paid = await recordPayment(tx, staff, w, now, { first: false, expectedEnd });
        // Rolls back the status move above with it.
        if (!paid) throw new Stale(w.name);
        await audit(tx, staff, w, "RENEWED", {
            to: "ACTIVE",
            periodFrom: paid.start.toISOString(),
            paidUntil: paid.end.toISOString(),
            invoice: paid.invoice.number,
        });

        const o = owner(w);
        return {
            ok: true,
            slug: w.slug,
            message: `${w.name}: paid up to ${billingDay(paid.end)}${restored ? ", and full access is back" : ""}. Tax invoice ${paid.invoice.number} is on its way to the owner.`,
            letter: o
                ? async () => {
                      await sendRenewalReceipt({
                          to: o.email,
                          firstName: o.firstName,
                          workshopName: w.name,
                          slug: w.slug,
                          paidUntil: paid.end,
                          amountInclVat: paid.amountInclVat,
                          restored,
                          invoice: await invoiceAttachment(paid.invoice),
                      });
                      await markEmailed(paid.invoice.id);
                  }
                : null,
        };
    });
}

// ── status only ──────────────────────────────────────────────────────────────

export async function cancelAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    return run(formData, async (tx, staff, w) => {
        const moved = await tx.tenant.updateMany({ where: { id: w.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
        if (moved.count !== 1) return STALE(w.name);
        if (w.subscription) await tx.subscription.update({ where: { id: w.subscription.id }, data: { status: "CANCELLED" } });
        await audit(tx, staff, w, "CANCELLED", { to: "CANCELLED" });
        // Nothing sent: this only ever applies to a registration that never paid.
        return { ok: true, slug: w.slug, message: `${w.name}: registration cancelled.`, letter: null };
    });
}

export async function suspendAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    return run(formData, async (tx, staff, w) => {
        const moved = await tx.tenant.updateMany({ where: { id: w.id, status: { in: ["ACTIVE", "PAST_DUE"] } }, data: { status: "SUSPENDED" } });
        if (moved.count !== 1) return STALE(w.name);
        await audit(tx, staff, w, "SUSPENDED", { to: "SUSPENDED" });
        const o = owner(w);
        return {
            ok: true,
            slug: w.slug,
            message: `${w.name}: suspended. The owner has been emailed.`,
            letter: o
                ? () =>
                      sendSuspensionLetter({
                          to: o.email,
                          firstName: o.firstName,
                          workshopName: w.name,
                          reference: w.subscription?.reference ?? null,
                          price: w.subscription ? Number(w.subscription.priceAmount) : null,
                      })
                : null,
        };
    });
}

/**
 * Back on without a payment — a suspension made in error, or a promise to pay
 * somebody has agreed to. A workshop whose period has long ended will be
 * marked read-only again by the next morning's run, which is right: nothing
 * has been paid. Recording the payment is the way to restore it for good.
 */
export async function reactivateAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    return run(formData, async (tx, staff, w) => {
        const moved = await tx.tenant.updateMany({ where: { id: w.id, status: { in: ["SUSPENDED", "PAST_DUE"] } }, data: { status: "ACTIVE" } });
        if (moved.count !== 1) return STALE(w.name);
        // Forget that the read-only notice was sent for this period, or the
        // morning run would see it as already handled and leave a workshop
        // that has still not paid fully on, indefinitely.
        if (w.subscription) await tx.subscription.update({ where: { id: w.subscription.id }, data: { overdueNoticeFor: null } });
        await audit(tx, staff, w, "REACTIVATED", { to: "ACTIVE" });
        const o = owner(w);
        return {
            ok: true,
            slug: w.slug,
            message: `${w.name}: switched back on. The owner has been emailed.`,
            letter: o ? () => sendRestoredLetter({ to: o.email, firstName: o.firstName, workshopName: w.name, slug: w.slug }) : null,
        };
    });
}

// ── billing for a workshop that predates it, and corrections ─────────────────

/**
 * Put a workshop that was switched on before plans existed onto a plan.
 *
 * No payment is recorded: whatever it last paid was arranged outside MOTION.
 * Staff give the date it is paid up to, and renewals run from there.
 */
export async function setUpBillingAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    const planId = String(formData.get("planId") ?? "");
    const plan = PLANS.find((p) => p.id === planId);
    const amount = Number(String(formData.get("amount") ?? "").replace(/[^\d.]/g, ""));
    const paidUntil = billingDateFromInput(String(formData.get("paidUntil") ?? ""));
    const period = String(formData.get("period") ?? "MONTHLY") as BillingPeriod;

    if (!plan) return { ok: false, message: "Choose a plan." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Enter the monthly amount, excluding VAT." };
    if (!paidUntil) return { ok: false, message: "Enter the date it is paid up to." };
    if (!["MONTHLY", "QUARTERLY", "ANNUAL"].includes(period)) return { ok: false, message: "Choose how often it renews." };

    return run(formData, async (tx, staff, w) => {
        if (w.subscription) return { ok: false, message: `${w.name} already has billing set up — change its paid-up-to date instead.` };
        if (w.status !== "ACTIVE" && w.status !== "PAST_DUE") return STALE(w.name);

        // The reference has a unique index across every workshop; a collision
        // is one in hundreds of millions, and is simply drawn again.
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                await tx.subscription.create({
                    data: {
                        tenantId: w.id,
                        planId: plan.id,
                        planName: plan.name,
                        priceAmount: amount,
                        period,
                        status: "ACTIVE",
                        reference: newReference(),
                        startedAt: paidUntil,
                        periodEndsAt: paidUntil,
                    },
                });
                break;
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && attempt < 4) continue;
                throw error;
            }
        }
        await audit(tx, staff, w, "BILLING_SET", { plan: plan.name, amountExclVat: amount, period, paidUntil: paidUntil.toISOString() });
        return { ok: true, slug: w.slug, message: `${w.name}: on ${plan.name}, paid up to ${billingDay(paidUntil)}.`, letter: null };
    });
}

/**
 * Correct the date a workshop is paid up to — a payment arranged by phone, a
 * month given free, a date set wrongly.
 *
 * Moving it later lifts read-only if the new date puts the workshop back in
 * good standing. Moving it earlier changes nothing today; the next morning's
 * run applies the rules to the new date.
 */
export async function setPaidUntilAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    const paidUntil = billingDateFromInput(String(formData.get("paidUntil") ?? ""));
    if (!paidUntil) return { ok: false, message: "Enter the date it is paid up to." };

    return run(formData, async (tx, staff, w, now) => {
        const sub = w.subscription;
        if (!sub || sub.status !== "ACTIVE") return { ok: false, message: `${w.name} has no active subscription to date.` };

        await tx.subscription.update({
            where: { id: sub.id },
            data: { periodEndsAt: paidUntil, startedAt: paidUntil, remindedFor: null, overdueNoticeFor: null },
        });
        const lifted = w.status === "PAST_DUE" && paidUntil.getTime() > now.getTime();
        if (lifted) await tx.tenant.updateMany({ where: { id: w.id, status: "PAST_DUE" }, data: { status: "ACTIVE" } });

        await audit(tx, staff, w, "PAID_UNTIL_CHANGED", {
            previous: sub.periodEndsAt?.toISOString() ?? null,
            paidUntil: paidUntil.toISOString(),
            ...(lifted ? { to: "ACTIVE" } : {}),
        });
        const o = owner(w);
        return {
            ok: true,
            slug: w.slug,
            message: `${w.name}: paid up to ${billingDay(paidUntil)}${lifted ? ", and read-only is lifted" : ""}.`,
            letter: lifted && o ? () => sendRestoredLetter({ to: o.email, firstName: o.firstName, workshopName: w.name, slug: w.slug }) : null,
        };
    });
}


// ── tax invoices ─────────────────────────────────────────────────────────────

function sendInvoice(w: Workshop, invoice: SubscriptionInvoice): Letter {
    const o = owner(w);
    if (!o) return null;
    return async () => {
        const { attachment } = await invoiceAttachment(invoice);
        await sendInvoiceLetter({
            to: o.email,
            firstName: o.firstName,
            workshopName: w.name,
            invoiceNumber: invoice.number,
            amountInclVat: Number(invoice.amountInclVat),
            attachment,
        });
        await markEmailed(invoice.id);
    };
}

/** Send an issued invoice to the owner again — it bounced, it was lost, or they asked. */
export async function resendInvoiceAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    const invoiceId = String(formData.get("invoiceId") ?? "");
    return run(formData, async (tx, staff, w) => {
        const invoice = await tx.subscriptionInvoice.findFirst({ where: { id: invoiceId, tenantId: w.id } });
        if (!invoice) return { ok: false, message: "That invoice is not this workshop's." };
        if (!owner(w)) return { ok: false, message: `${w.name} has no owner to send it to.` };
        await audit(tx, staff, w, "INVOICE_SENT", { invoice: invoice.number });
        return { ok: true, slug: w.slug, message: `Tax invoice ${invoice.number} is on its way to the owner.`, letter: sendInvoice(w, invoice) };
    });
}

/**
 * Issue the invoice for a payment recorded before invoices existed.
 *
 * Every payment recorded from now on gets its invoice in the same moment; this
 * is for the few confirmed before that, so their workshops are not left
 * without one.
 */
export async function issueInvoiceAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    const paymentId = String(formData.get("paymentId") ?? "");
    return run(formData, async (tx, staff, w, now) => {
        const payment = await tx.subscriptionPayment.findFirst({ where: { id: paymentId, tenantId: w.id }, select: { id: true, invoice: { select: { id: true } } } });
        if (!payment) return { ok: false, message: "That payment is not this workshop's." };
        if (payment.invoice) return { ok: false, message: "That payment already has its invoice — refresh to see it." };
        const invoice = await issueInvoice(tx, payment.id, now);
        await audit(tx, staff, w, "INVOICE_ISSUED", { invoice: invoice.number });
        return { ok: true, slug: w.slug, message: `Tax invoice ${invoice.number} issued and on its way to the owner.`, letter: sendInvoice(w, invoice) };
    });
}

/**
 * Record a payment that was made before MOTION recorded payments — the period
 * a workshop is paid up to right now — and issue its tax invoice.
 *
 * Only for a workshop with no payment recorded at all, which after this ships
 * means one that was switched on or set up by hand. It does not move the date:
 * the period it records is the one the workshop is already in.
 *
 * Staff decide whether the money really arrived. Nothing here can tell a real
 * payment from a test, and an issued tax invoice is a declaration of output
 * tax that stays on the record.
 */
export async function recordEarlierPaymentAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
    return run(formData, async (tx, staff, w, now) => {
        const sub = w.subscription;
        if (!sub || sub.status !== "ACTIVE" || !sub.periodEndsAt) return { ok: false, message: `${w.name} has no dated subscription.` };

        // Lock the subscription so two clicks cannot both find "no payments yet".
        await tx.$executeRaw`SELECT 1 FROM "Subscription" WHERE "id" = ${sub.id} FOR UPDATE`;
        if ((await tx.subscriptionPayment.count({ where: { tenantId: w.id } })) > 0) {
            return { ok: false, message: `${w.name} already has a payment recorded — refresh to see it.` };
        }

        const end = sub.periodEndsAt;
        const start = periodStartFor(end, sub.period, sub.startedAt ? anchorDayOf(sub.startedAt) : anchorDayOf(end));
        const price = Number(sub.priceAmount);
        const payment = await tx.subscriptionPayment.create({
            data: {
                tenantId: w.id,
                subscriptionId: sub.id,
                amountExclVat: price,
                amountInclVat: withVat(price),
                periodFrom: start,
                periodTo: end,
                confirmedById: staff.id,
                note: "Recorded after the fact: paid before MOTION recorded payments.",
            },
            select: { id: true },
        });
        const invoice = await issueInvoice(tx, payment.id, now);
        await audit(tx, staff, w, "PAYMENT_RECORDED", { periodFrom: start.toISOString(), paidUntil: end.toISOString(), invoice: invoice.number });
        return {
            ok: true,
            slug: w.slug,
            message: `${w.name}: payment for ${billingDay(start)} to ${billingDay(end)} recorded. Tax invoice ${invoice.number} is on its way to the owner.`,
            letter: sendInvoice(w, invoice),
        };
    });
}
