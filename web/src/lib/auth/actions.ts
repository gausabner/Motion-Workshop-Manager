"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireUser, signedInLanding } from "@/lib/auth/session";
import { createTenantDefaults } from "@/lib/tenant/defaults";
import { isReservedSlug } from "@/lib/auth/reserved-slugs";
import { PLANS } from "@/lib/pricing/plans";
import { newReference } from "@/lib/billing/reference";
import { announceRegistration } from "@/lib/billing/registration";
import { after } from "next/server";
import { consumePasswordReset } from "@/lib/team/recovery";
import { announceTenant } from "@/lib/tenant-db";
import { type ActionState, fromZod, str } from "@/lib/forms";
import { slugify } from "@/lib/slug";
import { COUNTRIES, countryDefaults } from "@/lib/tenant/country";

function safeNext(next: string | undefined): string | null {
    if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
    return next;
}

/**
 * `next` is where the visitor was heading before being asked to sign in. It is
 * safe as a *URL* once `safeNext` has checked it is relative — but safe is not
 * the same as usable, and the gap showed up the first time somebody signed out
 * of one workshop and straight into another on the same machine. The stale
 * `next` still named the first workshop, so the second person was redirected to
 * a dashboard they are not a member of and met a 404 on the far side of a
 * successful sign-in.
 *
 * Two people at one counter machine is not an edge case in a workshop.
 *
 * A path whose first segment is a reserved name is a static route and belongs
 * to nobody, so it passes. Anything else is a workshop address, and is only
 * honoured if this user is actually a member of it. A workshop they *are* in
 * but which has not paid is still allowed through: `requireTenant` redirects it
 * to `/activate`, which is the right destination and is better reached by the
 * route that owns that decision.
 */
async function usableNext(userId: string, next: string | null): Promise<string | null> {
    if (!next) return null;
    const first = next.split("?")[0].split("/").filter(Boolean)[0];
    if (!first || isReservedSlug(first)) return next;

    const membership = await prisma.membership.findFirst({
        where: { userId, status: "ACTIVE", tenant: { slug: first } },
        select: { id: true },
    });
    return membership ? next : null;
}

const loginSchema = z.object({
    email: z.email("Enter a valid email address").transform((s) => s.toLowerCase()),
    password: z.string({ error: "Enter your password." }).min(1, "Enter your password."),
    next: z.string().optional(),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = loginSchema.safeParse({ email: str(formData, "email"), password: formData.get("password") ?? "", next: str(formData, "next") });
    if (!parsed.success) return fromZod(parsed.error);
    const { email, password, next } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) return { ok: false, message: "Email or password is incorrect." };

    const ua = (await headers()).get("user-agent");
    await createSession(user.id, null, ua);
    // `signedInLanding` rather than a dashboard-or-register guess: a workshop
    // awaiting payment has a home now, and it is not the registration form.
    redirect((await usableNext(user.id, safeNext(next))) ?? (await signedInLanding(user.id)));
}

const registerSchema = z.object({
    workshopName: z.string().min(2, "Enter your workshop name.").max(120),
    slug: z
        .string()
        .min(3, "Use at least 3 characters.")
        .max(40)
        .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Lower-case letters, numbers and dashes only"),
    firstName: z.string({ error: "Enter a first name." }).min(1, "Enter a first name.").max(100),
    lastName: z.string({ error: "Enter a last name." }).min(1, "Enter a last name.").max(100),
    email: z.email("Enter a valid email address").transform((s) => s.toLowerCase()),
    password: z.string().min(8, "Use at least 8 characters.").max(200),
    mobile: z.string().max(40).optional(),
    country: z.enum(COUNTRIES as [string, ...string[]]).default("NA"),
    /**
     * Chosen here rather than afterwards.
     *
     * It used to be a second screen: register, then pick a tier at /activate.
     * A real registration walked straight into the gap — a workshop existed
     * with no plan, no agreed amount and no reference, which is a record
     * nobody can act on and a customer nobody can invoice. The tier is part of
     * the same form and the same transaction now, so that state cannot be
     * reached by closing a tab.
     */
    planId: z.string().refine((id) => PLANS.some((p) => p.id === id && p.price !== null), "Choose a plan"),
});

// "share" is the public document link route, which sits beside the workshop slugs.


export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = registerSchema.safeParse({
        planId: str(formData, "planId"),
        workshopName: str(formData, "workshopName"),
        slug: str(formData, "slug") ?? slugify(str(formData, "workshopName") ?? ""),
        firstName: str(formData, "firstName"),
        lastName: str(formData, "lastName"),
        email: str(formData, "email"),
        password: formData.get("password") ?? "",
        mobile: str(formData, "mobile"),
        country: str(formData, "country"),
    });
    if (!parsed.success) return fromZod(parsed.error);
    const d = parsed.data;
    const local = countryDefaults(d.country);
    if (isReservedSlug(d.slug)) return { ok: false, errors: { slug: ["That address is reserved — pick another"] } };

    // Looked up before the transaction opens, so a bad plan id fails as a form
    // error rather than as a rolled-back workshop.
    const plan = PLANS.find((p) => p.id === d.planId);
    if (!plan || plan.price === null) return { ok: false, errors: { planId: ["Choose a plan"] } };
    // Held as its own const: the narrowing above does not survive into the
    // transaction's closure, where TypeScript widens it back to number | null.
    const planPrice = plan.price;

    // Minted outside the transaction: a duplicate is a unique-constraint
    // violation that would abort the whole thing, and 28^6 makes one remote
    // enough that retrying the registration is the right answer rather than
    // looping inside it.
    const reference = newReference();

    const passwordHash = await hashPassword(d.password);
    let userId: string;
    let tenantId: string;
    try {
        ({ userId, tenantId } = await prisma.$transaction(async (tx) => {
            const existingTenant = await tx.tenant.findUnique({ where: { slug: d.slug } });
            if (existingTenant) throw new Error("SLUG_TAKEN");
            let user = await tx.user.findUnique({ where: { email: d.email } });
            if (user) {
                const ok = await verifyPassword(d.password, user.passwordHash);
                if (!ok) throw new Error("EMAIL_TAKEN");
            } else {
                user = await tx.user.create({ data: { email: d.email, passwordHash, firstName: d.firstName, lastName: d.lastName, mobile: d.mobile } });
            }
            const tenant = await tx.tenant.create({
                data: {
                    slug: d.slug, name: d.workshopName, email: d.email, mobile: d.mobile, whatsapp: d.mobile,
                    country: d.country, timezone: local.timezone, currency: local.currency, locale: local.locale,
                    taxName: local.taxName, salesTaxRate: local.taxRate, purchaseTaxRate: local.taxRate,
                    // Registering is not the same as being allowed in. Stated
                    // here as well as being the column default, because this is
                    // the one line that decides whether MOTION is sold or given
                    // away, and it should be readable at the place it happens.
                    status: "PENDING_PAYMENT",
                },
            });
            // Everything below writes tenant-owned rows, and row-level security
            // has no idea which workshop this is until it is told — there is no
            // membership yet to establish it, because the membership is one of
            // the rows being created.
            await announceTenant(tx, tenant.id);
            await tx.membership.create({
                data: { tenantId: tenant.id, userId: user.id, group: "OWNER", isServiceAdvisor: true, dashboardPrivileges: true },
            });
            await createTenantDefaults(tx, tenant.id);

            // The agreed deal, in the same transaction as the workshop. The
            // price is copied out of the catalogue rather than referenced, so
            // a later change to the published list cannot rewrite what this
            // customer signed up for.
            await tx.subscription.create({
                data: {
                    tenantId: tenant.id,
                    planId: plan.id,
                    planName: plan.name,
                    priceAmount: new Prisma.Decimal(planPrice),
                    reference,
                },
            });
            await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Tenant", entityId: tenant.id, action: "REGISTERED" } });
            return { userId: user.id, tenantId: tenant.id };
        }));
    } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "SLUG_TAKEN") return { ok: false, errors: { slug: ["That workshop address is already taken"] } };
        if (msg === "EMAIL_TAKEN") return { ok: false, errors: { email: ["An account with this email exists — sign in with its password to add a workshop"] } };
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: "That workshop address or email is already in use." };
        throw e;
    }

    // Tell the customer where to pay and the MOTION team that somebody is
    // waiting. After the response, not before it: two SMTP handshakes are
    // several seconds, and the person registering should land on /activate
    // rather than watch a spinner while we post letters. `after` keeps the
    // work alive until it settles, and neither letter can fail the
    // registration — that is already committed.
    //
    // This was missing when the plan moved into this form: the letter used to
    // be sent from the activation page's chooser, and registering here skipped
    // the chooser — so nobody was written to at all.
    after(() =>
        announceRegistration({
            tenantId,
            slug: d.slug,
            workshopName: d.workshopName,
            ownerEmail: d.email,
            ownerFirstName: d.firstName,
            ownerLastName: d.lastName,
            ownerMobile: d.mobile,
            planName: plan.name,
            price: planPrice,
            reference,
        }),
    );

    const ua = (await headers()).get("user-agent");
    await createSession(userId, null, ua);
    // Signed in, but to a workshop that cannot be used yet. `/activate` is the
    // only page the new tenant can reach, and it is outside `/[tenant]` because
    // `requireTenant` is what sends people there.
    redirect("/activate");
}

export async function logoutAction(): Promise<void> {
    await destroySession();
    redirect("/login");
}

// ───────────────────────── changing your own password ─────────────────────────

const changePasswordSchema = z
    .object({
        current: z.string({ error: "Enter your current password." }).min(1, "Enter your current password."),
        password: z.string().min(8, "Use at least 8 characters."),
        confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match." });

/**
 * Change your own password, and clear the flag that forces it.
 *
 * The current password is required even when MOTION is the one insisting on
 * the change. The commonest way this screen is reached is an owner handing
 * over a first password in person, and asking for it back is what stops the
 * next person at a shared counter machine — where somebody is often still
 * signed in — from setting a password on an account that is not theirs.
 *
 * Every other session is ended. If the reason for the change is that somebody
 * else knew the password, leaving their session alive would make the whole
 * exercise decorative.
 */
export async function changePasswordAction(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse({
        current: str(formData, "current"),
        password: str(formData, "password"),
        confirm: str(formData, "confirm"),
    });
    if (!parsed.success) return fromZod(parsed.error);

    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    if (!row || !(await verifyPassword(parsed.data.current, row.passwordHash))) {
        return { ok: false, message: "That is not your current password." };
    }
    if (await verifyPassword(parsed.data.password, row.passwordHash)) {
        return { ok: false, message: "Choose a password you have not used here before." };
    }

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: user.id },
            data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false },
        });
        await tx.session.deleteMany({ where: { userId: user.id } });
    });

    redirect(`/login?changed=1&next=${encodeURIComponent(`/${slug}/dashboard`)}`);
}

/**
 * Spend a reset link and set the password.
 *
 * No current password is asked for, because not having it is the entire reason
 * somebody is here. What stands in its place is the link: single-use, expiring,
 * stored only as a hash, and retired the moment a newer one is issued.
 */
export async function setPasswordFromResetAction(
    slug: string,
    token: string,
    _prev: ActionState,
    formData: FormData,
): Promise<ActionState> {
    const parsed = z
        .object({
            password: z.string().min(8, "Use at least 8 characters."),
            confirm: z.string(),
        })
        .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords do not match." })
        .safeParse({ password: str(formData, "password"), confirm: str(formData, "confirm") });
    if (!parsed.success) return fromZod(parsed.error);

    const done = await consumePasswordReset(token, parsed.data.password);
    if (!done) return { ok: false, message: "This link has expired or has already been used. Ask for another." };

    redirect(`/login?changed=1&next=${encodeURIComponent(`/${done.slug}/dashboard`)}`);
}
