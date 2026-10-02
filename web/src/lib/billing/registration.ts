import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { bankDetails } from "@/lib/billing/config";
import { newReference } from "@/lib/billing/reference";
import { PLANS, VAT_RATE, withVat, CURRENCY } from "@/lib/pricing/plans";
import { sendMail } from "@/lib/mail/send";
import { money } from "@/lib/format";

/**
 * Turning a registration into something MOTION can be paid for.
 *
 * A workshop arrives here with a tenant that exists and is `PENDING_PAYMENT`,
 * which means it can reach exactly one page. What happens on that page is: pick
 * a tier, get a reference, pay, and wait for somebody at MOTION to confirm it.
 *
 * Activation is deliberately *not* here. Nothing a customer can do should set
 * their own tenant to `ACTIVE` — that is a decision made by a person who has
 * looked at a bank statement, and in this phase it is made by
 * `ops/server/motion-activate-tenant`. The absence of a `activate()` export is
 * the point.
 */

export type PendingRegistration = {
    tenantId: string;
    slug: string;
    workshopName: string;
    email: string;
    firstName: string;
    subscription: {
        planId: string;
        planName: string;
        priceAmount: number;
        reference: string;
    } | null;
};

/**
 * The registration this signed-in person needs to finish, if there is one.
 *
 * A user may own more than one workshop, so this looks for one awaiting
 * payment rather than assuming they have exactly one. The most recent, because
 * the one somebody is trying to pay for is the one they just created.
 */
export async function pendingRegistrationFor(userId: string): Promise<PendingRegistration | null> {
    const membership = await prisma.membership.findFirst({
        where: { userId, status: "ACTIVE", tenant: { status: "PENDING_PAYMENT" } },
        orderBy: { createdAt: "desc" },
        select: {
            tenantId: true,
            tenant: { select: { slug: true, name: true, email: true } },
            user: { select: { firstName: true, email: true } },
        },
    });
    if (!membership) return null;

    // Scoped, because Subscription is FORCE RLS like everything else carrying a
    // tenantId. The tenant is known from the membership above, which is the
    // table allowed to establish it.
    const db = forTenant(membership.tenantId);
    const subscription = await db.subscription.findUnique({
        where: { tenantId: membership.tenantId },
        select: { planId: true, planName: true, priceAmount: true, reference: true },
    });

    return {
        tenantId: membership.tenantId,
        slug: membership.tenant.slug,
        workshopName: membership.tenant.name,
        email: membership.tenant.email ?? membership.user.email,
        firstName: membership.user.firstName,
        subscription: subscription
            ? {
                  planId: subscription.planId,
                  planName: subscription.planName,
                  // Decimal to number at the boundary, as everywhere else in
                  // this codebase: a Decimal must not reach a client component.
                  priceAmount: Number(subscription.priceAmount),
                  reference: subscription.reference,
              }
            : null,
    };
}

export type ChoosePlanResult = { ok: true; reference: string } | { ok: false; message: string };

/**
 * Record what a workshop agreed to pay, and tell them where to pay it.
 *
 * The price is copied out of the catalogue rather than referenced, so a change
 * to the published price list does not silently rewrite what this customer
 * signed up for — the same rule the product already applies to tax on a
 * document.
 */
export async function choosePlan(userId: string, planId: string): Promise<ChoosePlanResult> {
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) return { ok: false, message: "That is not a plan we offer." };
    if (plan.price === null) {
        // "Council and multi-site" is priced per site by a human. Issuing a
        // reference for an amount nobody has agreed would invite a payment for
        // the wrong sum, which is harder to undo than to prevent.
        return { ok: false, message: "That tier is quoted per site — talk to us and we will send you a figure." };
    }
    if (!bankDetails()) {
        return { ok: false, message: "We cannot take a registration right now. Please contact support." };
    }

    const pending = await pendingRegistrationFor(userId);
    if (!pending) return { ok: false, message: "There is no registration waiting on a plan." };

    const db = forTenant(pending.tenantId);

    // One live subscription per workshop. Choosing again before paying replaces
    // the row and reissues the reference, because somebody who changes their
    // mind between tiers must not be left holding a reference for the amount
    // they decided against.
    let reference = "";
    for (let attempt = 0; attempt < 5; attempt++) {
        reference = newReference();
        try {
            await db.subscription.upsert({
                where: { tenantId: pending.tenantId },
                create: {
                    tenantId: pending.tenantId,
                    planId: plan.id,
                    planName: plan.name,
                    priceAmount: new Prisma.Decimal(plan.price),
                    reference,
                },
                update: {
                    planId: plan.id,
                    planName: plan.name,
                    priceAmount: new Prisma.Decimal(plan.price),
                },
            });
            break;
        } catch (error) {
            // The reference has a unique index across every workshop. 28^6 makes
            // a clash remote, and the retry makes it harmless; without it a
            // collision would be a failed registration with no explanation.
            const clash = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
            if (!clash) throw error;
            if (attempt === 4) return { ok: false, message: "Could not issue a payment reference. Please try again." };
        }
    }

    // An upsert that updated an existing row kept its original reference, so
    // read back what is actually stored rather than reporting what was minted.
    const stored = await db.subscription.findUniqueOrThrow({
        where: { tenantId: pending.tenantId },
        select: { reference: true },
    });

    await sendRegistrationEmail({
        to: pending.email,
        firstName: pending.firstName,
        workshopName: pending.workshopName,
        planName: plan.name,
        price: plan.price,
        reference: stored.reference,
    }).catch((error: unknown) => {
        // The reference is on the screen as well as in the mail, so a failed
        // send costs the customer nothing immediate and must not lose the
        // registration that was just recorded.
        console.error("[billing] registration email could not be sent.", {
            to: pending.email,
            reference: stored.reference,
            error: error instanceof Error ? error.message : String(error),
        });
    });

    return { ok: true, reference: stored.reference };
}

async function sendRegistrationEmail(m: {
    to: string;
    firstName: string;
    workshopName: string;
    planName: string;
    price: number;
    reference: string;
}): Promise<void> {
    const bank = bankDetails();
    if (!bank) return;

    const total = withVat(m.price);
    const lines = [
        `Hi ${m.firstName},`,
        "",
        `${m.workshopName} is registered for MOTION on the ${m.planName} plan. One payment and you are in.`,
        "",
        `Amount        ${money(total)} (${money(m.price)} plus ${VAT_RATE}% VAT)`,
        `Reference     ${m.reference}`,
        "",
        `Bank          ${bank.bankName}`,
        `Account name  ${bank.accountName}`,
        `Account no    ${bank.accountNumber}`,
        `Branch code   ${bank.branchCode}`,
        ...(bank.accountType ? [`Account type  ${bank.accountType}`] : []),
        "",
        // Said twice on purpose. This is the whole reason a deposit can be
        // matched to a workshop, and it is the one field people leave blank.
        `Please use ${m.reference} as the payment reference. Without it we cannot tell which workshop paid, and your account will not be activated.`,
        "",
        "Send the proof of payment to this address and we will switch your workshop on, usually the same working day.",
        "",
        "— MOTION",
    ];

    await sendMail({
        to: m.to,
        subject: `Your MOTION registration — reference ${m.reference}`,
        text: lines.join("\n"),
    });
}

/** What the activation page needs to print, in one place so the mail and the page agree. */
export function paymentSummary(price: number) {
    return {
        exclusive: money(price),
        inclusive: money(withVat(price)),
        vatRate: VAT_RATE,
        currency: CURRENCY,
    };
}
