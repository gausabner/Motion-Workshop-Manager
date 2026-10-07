import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { bankDetails } from "@/lib/billing/config";
import { newReference } from "@/lib/billing/reference";
import { PLANS, VAT_RATE, withVat, CURRENCY } from "@/lib/pricing/plans";
import { sendMail } from "@/lib/mail/send";
import { money } from "@/lib/format";
import { support } from "@/lib/edition";
import { billingDay } from "@/lib/billing/periods";

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
    // No bank-details gate here. There used to be one, and it hid the whole
    // chooser on a deployment whose bank details were not configured — so a
    // workshop registered before plans moved into the form had no way to
    // choose one at all. Choosing a plan needs no bank account; paying does,
    // and the payment step says so on its own when they are missing.

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

    await announceRegistration({
        tenantId: pending.tenantId,
        slug: pending.slug,
        workshopName: pending.workshopName,
        ownerEmail: pending.email,
        ownerFirstName: pending.firstName,
        planName: plan.name,
        price: plan.price,
        reference: stored.reference,
    });

    return { ok: true, reference: stored.reference };
}

export type RegistrationNotice = {
    tenantId: string;
    slug: string;
    workshopName: string;
    ownerEmail: string;
    ownerFirstName: string;
    ownerLastName?: string | null;
    ownerMobile?: string | null;
    planName: string;
    price: number;
    reference: string;
};

/**
 * Tell both sides a registration exists: the customer where to pay, and the
 * MOTION team that somebody is waiting on them.
 *
 * Two letters, sent independently, and neither allowed to fail the other or
 * the registration. A dead mailbox must not lose a workshop that was just
 * recorded — and it must not stop the team hearing about it either, which is
 * the half that was missing: a workshop could register and sit unprocessed
 * because nothing told anybody it had arrived.
 *
 * Called from both places a plan is fixed — the registration form, and the
 * activation page for workshops registered before plans were part of it.
 */
export async function announceRegistration(n: RegistrationNotice): Promise<void> {
    const results = await Promise.allSettled([sendCustomerLetter(n), sendTeamNotice(n)]);
    results.forEach((r, i) => {
        if (r.status === "rejected") {
            console.error(`[billing] registration ${i === 0 ? "customer" : "team"} email could not be sent.`, {
                workshop: n.slug,
                reference: n.reference,
                error: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
        }
    });
}

/** Where a customer sends proof and questions — a mailbox somebody reads, never the no-reply sender. */
export function supportAddress(): string | null {
    return support().email;
}

/**
 * Who at MOTION hears about a new registration.
 *
 * Its own setting so the notices can go to a shared inbox the team watches
 * without changing the address customers are shown, and falling back to the
 * support address so a deployment that sets neither still tells somebody.
 */
export function teamAddress(): string | null {
    return process.env.BILLING_NOTIFY_EMAIL?.trim() || supportAddress();
}

export function appUrl(): string {
    return (process.env.APP_URL?.trim() || "").replace(/\/$/, "");
}

async function sendCustomerLetter(n: RegistrationNotice): Promise<void> {
    const bank = bankDetails();
    const reach = supportAddress();
    const total = withVat(n.price);

    const lines = [
        `Hi ${n.ownerFirstName},`,
        "",
        `${n.workshopName} is registered for MOTION on the ${n.planName} plan. One payment and you are in.`,
        "",
        `Amount        ${money(total)} (${money(n.price)} plus ${VAT_RATE}% VAT)`,
        `Reference     ${n.reference}`,
        "",
        ...(bank
            ? [
                  `Bank          ${bank.bankName}`,
                  `Account name  ${bank.accountName}`,
                  `Account no    ${bank.accountNumber}`,
                  `Branch code   ${bank.branchCode}`,
                  ...(bank.accountType ? [`Account type  ${bank.accountType}`] : []),
                  "",
              ]
            : ["We will send you the bank details to pay into shortly.", ""]),
        // Said twice on purpose. This is the whole reason a deposit can be
        // matched to a workshop, and it is the one field people leave blank.
        `Please use ${n.reference} as the payment reference. Without it we cannot tell which workshop paid, and your account will not be activated.`,
        "",
        // A real address, not "reply to this email". This letter is sent from
        // no-reply@, and telling somebody to reply to it — which it used to —
        // sends their proof of payment into a bounce.
        reach
            ? `Send the proof of payment to ${reach} and we will switch your workshop on, usually the same working day.`
            : "Once your payment has cleared we will switch your workshop on, usually the same working day.",
        "",
        "— MOTION",
    ];

    await sendMail({
        to: n.ownerEmail,
        subject: `Your MOTION registration — reference ${n.reference}`,
        text: lines.join("\n"),
    });
}

async function sendTeamNotice(n: RegistrationNotice): Promise<void> {
    const to = teamAddress();
    if (!to) {
        console.error("[billing] no BILLING_NOTIFY_EMAIL or MOTION_SUPPORT_EMAIL is set, so nobody was told about a new registration.", {
            workshop: n.slug,
            reference: n.reference,
        });
        return;
    }
    const owner = [n.ownerFirstName, n.ownerLastName].filter(Boolean).join(" ");
    const base = appUrl();

    await sendMail({
        to,
        // The reference leads, because it is what the team will search the
        // bank statement for — and the subject is what they see first.
        subject: `New registration ${n.reference} — ${n.workshopName}`,
        text: [
            `${n.workshopName} has registered and is waiting on payment.`,
            "",
            `Reference     ${n.reference}`,
            `Plan          ${n.planName}`,
            `Amount        ${money(withVat(n.price))} (${money(n.price)} plus ${VAT_RATE}% VAT)`,
            "",
            `Owner         ${owner}`,
            `Email         ${n.ownerEmail}`,
            ...(n.ownerMobile ? [`Mobile        ${n.ownerMobile}`] : []),
            `Address       /${n.slug}`,
            "",
            "When the payment shows on the statement under that reference, approve it here:",
            "",
            base ? `${base}/admin` : "/admin",
            "",
            "— MOTION",
        ].join("\n"),
    });
}

/**
 * The "you are in" letter, once MOTION has confirmed a payment.
 *
 * The only signal a customer gets that their deposit was found. Without it
 * they are active and have no idea — and they keep checking a bank app
 * instead of using the product they paid for.
 */
export async function sendActivationLetter(n: { to: string; firstName: string; workshopName: string; slug: string; paidUntil: Date }): Promise<void> {
    const base = appUrl();
    await sendMail({
        to: n.to,
        subject: `${n.workshopName} is live on MOTION`,
        text: [
            `Hi ${n.firstName},`,
            "",
            `Your payment has been received and ${n.workshopName} is switched on. Sign in here:`,
            "",
            `${base}/${n.slug}/dashboard`,
            "",
            "Use the same email and password you registered with. If you have forgotten it, there is a link on the sign-in page.",
            "",
            // Said now, so the first reminder is not the first they hear of it.
            `You are paid up to ${billingDay(n.paidUntil)}. We will email you a week before the next payment is due, with the same reference to use.`,
            "",
            "Welcome aboard.",
            "",
            "— MOTION",
        ].join("\n"),
    });
}

/**
 * The workshop this signed-in person belongs to that MOTION has switched off.
 *
 * Suspension pauses access and nothing else, so what `/paused` needs is what
 * `/activate` needs: the agreed amount and the reference a payment should
 * carry, so paying late is as easy as paying on time was.
 */
export async function suspendedWorkshopFor(userId: string): Promise<{
    workshopName: string;
    subscription: { planName: string; priceAmount: number; reference: string } | null;
} | null> {
    const membership = await prisma.membership.findFirst({
        where: { userId, status: "ACTIVE", tenant: { status: "SUSPENDED" } },
        orderBy: { createdAt: "asc" },
        select: { tenantId: true, tenant: { select: { name: true } } },
    });
    if (!membership) return null;

    const subscription = await forTenant(membership.tenantId).subscription.findUnique({
        where: { tenantId: membership.tenantId },
        select: { planName: true, priceAmount: true, reference: true },
    });
    return {
        workshopName: membership.tenant.name,
        subscription: subscription ? { ...subscription, priceAmount: Number(subscription.priceAmount) } : null,
    };
}

/**
 * Access paused. Says, before anything else, that nothing is lost — that is the
 * question an owner locked out of their own records asks first — and then
 * exactly what to pay to have it back.
 */
export async function sendSuspensionLetter(n: {
    to: string;
    firstName: string;
    workshopName: string;
    reference: string | null;
    price: number | null;
}): Promise<void> {
    const bank = bankDetails();
    const reach = supportAddress();
    const base = appUrl();

    const lines = [
        `Hi ${n.firstName},`,
        "",
        `Access to ${n.workshopName} on MOTION has been paused because we have not received your payment.`,
        "",
        "Nothing has been deleted. Your customers, vehicles, jobs, quotes and invoices are kept exactly as they were — only signing in is paused.",
        "",
        "To restore access, make the payment below. As soon as we confirm it, we will switch your workshop back on and let you know.",
        "",
        ...(n.price !== null ? [`Amount        ${money(withVat(n.price))} (${money(n.price)} plus ${VAT_RATE}% VAT)`] : []),
        ...(n.reference ? [`Reference     ${n.reference}`] : []),
        ...(n.price !== null || n.reference ? [""] : []),
        ...(bank
            ? [
                  `Bank          ${bank.bankName}`,
                  `Account name  ${bank.accountName}`,
                  `Account no    ${bank.accountNumber}`,
                  `Branch code   ${bank.branchCode}`,
                  ...(bank.accountType ? [`Account type  ${bank.accountType}`] : []),
                  "",
              ]
            : []),
        ...(n.reference ? [`Please use ${n.reference} as the payment reference so we can match it to your workshop.`, ""] : []),
        reach
            ? `Send the proof of payment to ${reach}, or write to us there if you think this is a mistake.`
            : "If you think this is a mistake, contact MOTION support.",
        "",
        ...(base ? ["The same details are on your sign-in page:", "", `${base}/login`, ""] : []),
        "— MOTION",
    ];

    await sendMail({
        to: n.to,
        subject: `Access to ${n.workshopName} is paused — your data is safe`,
        text: lines.join("\n"),
    });
}

/** Access back. Short, because the only thing they want to know is that it worked. */
export async function sendRestoredLetter(n: { to: string; firstName: string; workshopName: string; slug: string }): Promise<void> {
    const base = appUrl();
    await sendMail({
        to: n.to,
        subject: `${n.workshopName} is switched back on`,
        text: [
            `Hi ${n.firstName},`,
            "",
            `Thank you — ${n.workshopName} is switched back on, with everything exactly where you left it. Sign in here:`,
            "",
            `${base}/${n.slug}/dashboard`,
            "",
            "— MOTION",
        ].join("\n"),
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
