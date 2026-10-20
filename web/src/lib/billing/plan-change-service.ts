import "server-only";

import { Prisma, type BillingPeriod, type PlanChangeRequest, type TenantStatus } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { amountDue, changeKind, featureDiff, requestRefusal, unusedDays, type ChangeKind } from "@/lib/billing/plan-change";
import { asPlanId } from "@/lib/plans/features";
import { PLANS } from "@/lib/pricing/plans";

/**
 * Asking for, and taking back, a plan change — the workshop's half, run
 * through the workshop's own scoped client so a request can only ever be made
 * for the workshop the person is signed in to. Staff decide requests in
 * `app/admin/actions.ts`, under the platform exemption.
 */

export type PendingChange = Pick<
    PlanChangeRequest,
    "id" | "fromPlanId" | "fromPlanName" | "toPlanId" | "toPlanName" | "requestedAt"
> & { kind: ChangeKind; fromPrice: number; toPrice: number; amountExclVat: number; amountInclVat: number };

const PENDING_SELECT = {
    id: true,
    fromPlanId: true,
    fromPlanName: true,
    fromPrice: true,
    toPlanId: true,
    toPlanName: true,
    toPrice: true,
    amountExclVat: true,
    amountInclVat: true,
    requestedAt: true,
} satisfies Prisma.PlanChangeRequestSelect;

/** The workshop's open request, if it has one, with its figures as plain numbers. */
export async function pendingChange(db: TenantDb, tenantId: string): Promise<PendingChange | null> {
    const r = await db.planChangeRequest.findFirst({ where: { tenantId, status: "PENDING" }, select: PENDING_SELECT });
    if (!r) return null;
    // A request is only ever logged for a real move, so a missing kind cannot
    // happen; a move up is the safe reading, because it is the one that asks
    // for money before anything changes.
    const to = asPlanId(r.toPlanId);
    return {
        ...r,
        kind: (to && changeKind(asPlanId(r.fromPlanId), to)) || "upgrade",
        fromPrice: Number(r.fromPrice),
        toPrice: Number(r.toPrice),
        amountExclVat: Number(r.amountExclVat),
        amountInclVat: Number(r.amountInclVat),
    };
}

export type CreatedChange = {
    request: PendingChange;
    reference: string;
    period: BillingPeriod;
    periodEndsAt: Date | null;
    unusedDays: number;
    gained: string[];
    lost: string[];
};

/**
 * Logs a request, or says in words why it cannot be made. The subscription row
 * is locked first and the open-request index backs it up, so two presses —
 * or two tabs — leave one request, not two.
 */
export async function createChange(
    db: TenantDb,
    input: { tenantId: string; tenantStatus: TenantStatus; userId: string; toPlanId: string; now: Date },
): Promise<{ ok: true; change: CreatedChange } | { ok: false; message: string }> {
    try {
        return await db.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT 1 FROM "Subscription" WHERE "tenantId" = ${input.tenantId} FOR UPDATE`;
            const sub = await tx.subscription.findUnique({
                where: { tenantId: input.tenantId },
                select: { id: true, planId: true, planName: true, priceAmount: true, status: true, period: true, reference: true, periodEndsAt: true },
            });
            const open = await tx.planChangeRequest.count({ where: { tenantId: input.tenantId, status: "PENDING" } });
            const refusal = requestRefusal({ tenantStatus: input.tenantStatus, subscription: sub, toPlanId: input.toPlanId, hasPending: open > 0 });
            if (refusal || !sub) return { ok: false as const, message: refusal ?? "Choose a plan." };

            const from = asPlanId(sub.planId);
            const to = asPlanId(input.toPlanId)!;
            const target = PLANS.find((p) => p.id === to)!;
            const kind = changeKind(from, to)!;
            const due = amountDue(kind, target.price!);
            const created = await tx.planChangeRequest.create({
                data: {
                    tenantId: input.tenantId,
                    subscriptionId: sub.id,
                    fromPlanId: sub.planId,
                    fromPlanName: sub.planName,
                    fromPrice: sub.priceAmount,
                    toPlanId: to,
                    toPlanName: target.name,
                    toPrice: target.price!,
                    amountExclVat: due.exclVat,
                    amountInclVat: due.inclVat,
                    requestedById: input.userId,
                },
                select: PENDING_SELECT,
            });
            const { gained, lost } = featureDiff(from, to);
            return {
                ok: true as const,
                change: {
                    request: {
                        ...created,
                        kind,
                        fromPrice: Number(created.fromPrice),
                        toPrice: Number(created.toPrice),
                        amountExclVat: Number(created.amountExclVat),
                        amountInclVat: Number(created.amountInclVat),
                    },
                    reference: sub.reference,
                    period: sub.period,
                    periodEndsAt: sub.periodEndsAt,
                    unusedDays: unusedDays(sub.periodEndsAt, input.now),
                    gained,
                    lost,
                },
            };
        });
    } catch (error) {
        // The partial unique index: a second request raced the first past the count.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return { ok: false, message: "You already have a plan change waiting. Withdraw it first to ask for a different one." };
        }
        throw error;
    }
}

/** Takes back an open request. Only a PENDING one moves, so a request staff already decided stays decided. */
export async function withdrawChange(db: TenantDb, tenantId: string, requestId: string): Promise<boolean> {
    const moved = await db.planChangeRequest.updateMany({
        where: { id: requestId, tenantId, status: "PENDING" },
        data: { status: "WITHDRAWN", decidedAt: new Date() },
    });
    return moved.count === 1;
}
