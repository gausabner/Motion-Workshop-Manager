import type { BillingPeriod, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { addPeriod, anchorDayOf } from "@/lib/billing/periods";
import { ALL_FEATURES, FEATURES, asPlanId, includes, type PlanId } from "@/lib/plans/features";
import { PLANS, withVat, type Plan } from "@/lib/pricing/plans";

/**
 * The rules for a workshop moving to another plan, as pure functions.
 *
 * Decided with the owner of the business on 20 October 2026:
 *
 * - **Moving up** is paid for first: one full period at the new plan's price.
 *   When staff confirm that payment the plan changes and the paid-up-to date
 *   restarts from that day. Days left on the old plan are not refunded or
 *   credited — the review screen says so, with the number of days, before the
 *   owner asks.
 * - **Moving down** needs no payment. It is applied when staff approve it: the
 *   features the smaller plan lacks are locked straight away (the records in
 *   them are kept), and the lower price applies from the next renewal.
 *
 * Kept free of the database and the clock so the review screen, the request,
 * the admin approval and the emails all work the same figures out the same way.
 */

export type ChangeKind = "upgrade" | "downgrade";

const RANK: Record<PlanId, number> = { workshop: 0, full: 1, council: 2 };

/** Up or down, or null when it is not a change at all. */
export function changeKind(from: PlanId | null, to: PlanId): ChangeKind | null {
    if (from === to) return null;
    if (from === null) return "upgrade";
    return RANK[to] > RANK[from] ? "upgrade" : "downgrade";
}

/** The plans an owner can ask to move to by themselves: priced, and not the one they are on. */
export function requestablePlans(current: PlanId | null): Plan[] {
    return PLANS.filter((p) => p.price !== null && asPlanId(p.id) !== current);
}

/** What is added and what is locked, by feature name, for the review screen and the emails. */
export function featureDiff(from: PlanId | null, to: PlanId): { gained: string[]; lost: string[] } {
    return {
        gained: ALL_FEATURES.filter((f) => includes(to, f) && !includes(from, f)).map((f) => FEATURES[f].name),
        lost: ALL_FEATURES.filter((f) => !includes(to, f) && includes(from, f)).map((f) => FEATURES[f].name),
    };
}

/** What has to be paid before the change is applied. A move down costs nothing now. */
export function amountDue(kind: ChangeKind, toPrice: number): { exclVat: number; inclVat: number } {
    return kind === "upgrade" ? { exclVat: toPrice, inclVat: withVat(toPrice) } : { exclVat: 0, inclVat: 0 };
}

/**
 * The period a move up pays for, if it were confirmed at `at`: one full period
 * from that day, with that day of the month as the new billing day.
 */
export function upgradePeriod(at: Date, period: BillingPeriod): { from: Date; to: Date } {
    return { from: at, to: addPeriod(at, period, anchorDayOf(at)) };
}

/**
 * Whole days left on the current paid period at `at` — the days a move up
 * gives up. Rounded down, so a part-day is never promised.
 */
export function unusedDays(periodEndsAt: Date | null, at: Date): number {
    if (!periodEndsAt) return 0;
    return Math.max(0, Math.floor((periodEndsAt.getTime() - at.getTime()) / 86_400_000));
}

/**
 * Why a workshop cannot ask for a change right now, in words for the owner,
 * or null when it can. Checked on the screen and again in the action.
 */
export function requestRefusal(input: {
    tenantStatus: TenantStatus;
    subscription: { status: SubscriptionStatus; planId: string; periodEndsAt: Date | null } | null;
    toPlanId: string;
    hasPending: boolean;
}): string | null {
    const to = asPlanId(input.toPlanId);
    const target = PLANS.find((p) => p.id === input.toPlanId);
    if (!to || !target) return "Choose a plan.";
    if (target.price === null) return "That plan is quoted per site. Contact us for a quote.";
    if (!input.subscription || input.subscription.status !== "ACTIVE") {
        return "Your billing is arranged directly with MOTION. Contact us to change plan.";
    }
    if (input.tenantStatus !== "ACTIVE") return "Pay the overdue subscription first, then change plan.";
    if (asPlanId(input.subscription.planId) === to) return `Your workshop is already on the ${target.name} plan.`;
    if (input.hasPending) return "You already have a plan change waiting. Withdraw it first to ask for a different one.";
    return null;
}
