import "server-only";

import type { BillingPeriod, Prisma, SubscriptionInvoice, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { issueInvoice } from "@/lib/billing/invoices";
import { changeKind, featureDiff, upgradePeriod, type ChangeKind } from "@/lib/billing/plan-change";
import { asPlanId, type PlanId } from "@/lib/plans/features";

/**
 * MOTION's half of a plan change: applying it, or turning it down.
 *
 * Runs inside a staff transaction (`asStaff`), which is the only kind of
 * session the database lets write another workshop's subscription. Kept apart
 * from the server action so it can be exercised against a real database.
 *
 * Every move claims the request first — PENDING to APPROVED or DECLINED, one
 * row or nothing — so two members of staff with the same screen open, or one
 * double click, apply a change once and record one payment.
 */

type Tx = Prisma.TransactionClient;

export type Applied = {
    kind: ChangeKind;
    from: PlanId | null;
    to: PlanId;
    toPlanName: string;
    price: number;
    gained: string[];
    lost: string[];
    requestedBy: { email: string; firstName: string } | null;
    /** The next renewal the new price is charged at. */
    nextRenewal: Date | null;
    /** A move up only: what was paid, for which period, and its tax invoice. */
    paid: { amountInclVat: number; from: Date; to: Date; invoice: SubscriptionInvoice } | null;
    /** A read-only workshop whose move up brought it back to full access. */
    restored: boolean;
};

export async function applyPlanChange(
    tx: Tx,
    input: {
        staffId: string;
        tenant: { id: string; name: string; status: TenantStatus };
        subscription: { id: string; status: SubscriptionStatus; period: BillingPeriod; periodEndsAt: Date | null } | null;
        requestId: string;
        now: Date;
    },
): Promise<{ ok: true; applied: Applied } | { ok: false; stale: boolean; message: string }> {
    const { tenant, subscription: sub, now } = input;
    const req = await tx.planChangeRequest.findFirst({
        where: { id: input.requestId, tenantId: tenant.id },
        select: {
            id: true,
            status: true,
            fromPlanId: true,
            fromPlanName: true,
            toPlanId: true,
            toPlanName: true,
            toPrice: true,
            amountExclVat: true,
            amountInclVat: true,
            requestedBy: { select: { email: true, firstName: true } },
        },
    });
    if (!req || req.status !== "PENDING") return { ok: false, stale: true, message: "stale" };
    if (!sub || sub.status !== "ACTIVE") return { ok: false, stale: false, message: `${tenant.name} has no active subscription to change. Set up its billing first.` };

    const from = asPlanId(req.fromPlanId);
    const to = asPlanId(req.toPlanId);
    const kind = to ? changeKind(from, to) : null;
    if (!to || !kind) return { ok: false, stale: false, message: "That request names a plan MOTION does not offer. Decline it instead." };
    if (kind === "upgrade" && tenant.status !== "ACTIVE" && tenant.status !== "PAST_DUE") {
        return {
            ok: false,
            stale: false,
            message: `${tenant.name} is ${tenant.status === "SUSPENDED" ? "suspended" : "not active"}. Switch it back on before applying a paid change.`,
        };
    }

    const claimed = await tx.planChangeRequest.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: { status: "APPROVED", decidedById: input.staffId, decidedAt: now },
    });
    if (claimed.count !== 1) return { ok: false, stale: true, message: "stale" };

    const price = Number(req.toPrice);
    const { gained, lost } = featureDiff(from, to);
    const base = { kind, from, to, toPlanName: req.toPlanName, price, gained, lost, requestedBy: req.requestedBy };

    if (kind === "downgrade") {
        await tx.subscription.update({ where: { id: sub.id }, data: { planId: to, planName: req.toPlanName, priceAmount: price } });
        return { ok: true, applied: { ...base, nextRenewal: sub.periodEndsAt, paid: null, restored: false } };
    }

    // A move up: the payment for one full period from today is what applies it.
    const restored = tenant.status === "PAST_DUE";
    if (restored) {
        const moved = await tx.tenant.updateMany({ where: { id: tenant.id, status: "PAST_DUE" }, data: { status: "ACTIVE" } });
        if (moved.count !== 1) throw new Error("stale");
    }
    const period = upgradePeriod(now, sub.period);
    await tx.subscription.update({
        where: { id: sub.id },
        data: { planId: to, planName: req.toPlanName, priceAmount: price, status: "ACTIVE", startedAt: period.from, periodEndsAt: period.to },
    });
    const payment = await tx.subscriptionPayment.create({
        data: {
            tenantId: tenant.id,
            subscriptionId: sub.id,
            amountExclVat: req.amountExclVat,
            amountInclVat: req.amountInclVat,
            periodFrom: period.from,
            periodTo: period.to,
            confirmedById: input.staffId,
            note: `Move from ${req.fromPlanName} to ${req.toPlanName}`,
        },
        select: { id: true },
    });
    await tx.planChangeRequest.update({ where: { id: req.id }, data: { paymentId: payment.id } });
    // After the plan changed, so the invoice names the plan that was paid for.
    const invoice = await issueInvoice(tx, payment.id, now);
    return {
        ok: true,
        applied: {
            ...base,
            nextRenewal: period.to,
            paid: { amountInclVat: Number(req.amountInclVat), from: period.from, to: period.to, invoice },
            restored,
        },
    };
}

export async function declinePlanChange(
    tx: Tx,
    input: { staffId: string; tenantId: string; requestId: string; reason: string; now: Date },
): Promise<{ toPlanId: string; toPlanName: string; requestedBy: { email: string; firstName: string } | null } | null> {
    const claimed = await tx.planChangeRequest.updateMany({
        where: { id: input.requestId, tenantId: input.tenantId, status: "PENDING" },
        data: { status: "DECLINED", decidedById: input.staffId, decidedAt: input.now, declineReason: input.reason },
    });
    if (claimed.count !== 1) return null;
    return tx.planChangeRequest.findUniqueOrThrow({
        where: { id: input.requestId },
        select: { toPlanId: true, toPlanName: true, requestedBy: { select: { email: true, firstName: true } } },
    });
}
