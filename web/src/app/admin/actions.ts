"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { TenantStatus } from "@prisma/client";
import { asStaff } from "@/lib/admin/platform";
import { sendActivationLetter } from "@/lib/billing/registration";

export type AdminActionState = { ok: boolean; message: string };

/**
 * What MOTION's staff can do to a workshop's standing, and nothing more.
 *
 * Four moves, each from one status to another. They are written as guarded
 * transitions rather than plain updates: the `where` names the status the
 * workshop must currently be in, and the move only happens if exactly one row
 * matched. Two people approving the same deposit at once therefore produce one
 * activation, one audit entry and one welcome email — not two of each — and a
 * workshop that somebody else already suspended cannot be "approved" back on
 * by a stale screen.
 *
 * None of these touch a workshop's own data, and could not if they tried: the
 * staff exemption in the database covers the billing tables only.
 */

type Move = {
    action: "ACTIVATED" | "CANCELLED" | "SUSPENDED" | "REACTIVATED";
    from: TenantStatus[];
    to: TenantStatus;
    /** A paid registration must have an agreed amount; the others need none. */
    needsPlan?: boolean;
    done: string;
};

const MOVES: Record<string, Move> = {
    activate: {
        action: "ACTIVATED",
        from: ["PENDING_PAYMENT"],
        to: "ACTIVE",
        needsPlan: true,
        done: "switched on, and the owner has been emailed",
    },
    cancel: { action: "CANCELLED", from: ["PENDING_PAYMENT"], to: "CANCELLED", done: "registration cancelled" },
    suspend: { action: "SUSPENDED", from: ["ACTIVE", "PAST_DUE"], to: "SUSPENDED", done: "suspended" },
    reactivate: { action: "REACTIVATED", from: ["SUSPENDED"], to: "ACTIVE", done: "switched back on" },
};

async function transition(kind: keyof typeof MOVES, formData: FormData): Promise<AdminActionState> {
    const move = MOVES[kind];
    const tenantId = String(formData.get("tenantId") ?? "");
    if (!tenantId) return { ok: false, message: "No workshop was named." };

    const result = await asStaff(async (tx, staff) => {
        const workshop = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                slug: true,
                name: true,
                status: true,
                subscription: { select: { reference: true, planName: true, priceAmount: true } },
                memberships: {
                    where: { group: "OWNER" },
                    orderBy: { createdAt: "asc" },
                    take: 1,
                    select: { user: { select: { email: true, firstName: true } } },
                },
            },
        });
        if (!workshop) return { ok: false as const, message: "That workshop no longer exists." };

        // Refused rather than guessed at. With no plan there is no amount and
        // no reference, so there is nothing a payment could have been matched
        // against — approving it would be switching on a workshop on trust.
        if (move.needsPlan && !workshop.subscription) {
            return {
                ok: false as const,
                message: `${workshop.name} has not chosen a plan, so there is no amount to have been paid. They can choose one at /activate.`,
            };
        }

        const moved = await tx.tenant.updateMany({
            where: { id: workshop.id, status: { in: move.from } },
            data: { status: move.to },
        });
        if (moved.count !== 1) {
            return { ok: false as const, message: `${workshop.name} is no longer in a state where that applies — refresh to see where it stands.` };
        }

        if (kind === "activate") {
            await tx.subscription.update({ where: { tenantId: workshop.id }, data: { status: "ACTIVE" } });
        }
        if (kind === "cancel" && workshop.subscription) {
            await tx.subscription.update({ where: { tenantId: workshop.id }, data: { status: "CANCELLED" } });
        }

        await tx.platformAuditEvent.create({
            data: {
                actorUserId: staff.id,
                action: move.action,
                tenantId: workshop.id,
                detail: {
                    from: workshop.status,
                    to: move.to,
                    reference: workshop.subscription?.reference ?? null,
                    plan: workshop.subscription?.planName ?? null,
                    amountExclVat: workshop.subscription ? Number(workshop.subscription.priceAmount) : null,
                },
            },
        });

        return { ok: true as const, workshop, owner: workshop.memberships[0]?.user ?? null };
    });

    if (!result.ok) return { ok: false, message: result.message };

    // The "you are in" letter, after the response. It is the only signal the
    // customer gets that their deposit was found; the activation itself is
    // already committed, so a failed send costs a letter, not an approval.
    if (kind === "activate" && result.owner) {
        const { owner, workshop } = result;
        after(() =>
            sendActivationLetter({ to: owner.email, firstName: owner.firstName, workshopName: workshop.name, slug: workshop.slug }).catch(
                (error: unknown) =>
                    console.error("[admin] activation email could not be sent.", {
                        workshop: workshop.slug,
                        error: error instanceof Error ? error.message : String(error),
                    }),
            ),
        );
    }

    revalidatePath("/admin");
    return { ok: true, message: `${result.workshop.name}: ${move.done}.` };
}

export async function activateAction(_prev: AdminActionState, formData: FormData) {
    return transition("activate", formData);
}
export async function cancelAction(_prev: AdminActionState, formData: FormData) {
    return transition("cancel", formData);
}
export async function suspendAction(_prev: AdminActionState, formData: FormData) {
    return transition("suspend", formData);
}
export async function reactivateAction(_prev: AdminActionState, formData: FormData) {
    return transition("reactivate", formData);
}
