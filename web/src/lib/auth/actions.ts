"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, defaultTenantSlug } from "@/lib/auth/session";
import { createTenantDefaults } from "@/lib/tenant/defaults";
import { type ActionState, fromZod, str } from "@/lib/forms";
import { slugify } from "@/lib/slug";
import { COUNTRIES, countryDefaults } from "@/lib/tenant/country";

function safeNext(next: string | undefined): string | null {
    if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
    return next;
}

const loginSchema = z.object({
    email: z.email("Enter a valid email address").transform((s) => s.toLowerCase()),
    password: z.string().min(1, "Enter your password"),
    next: z.string().optional(),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = loginSchema.safeParse({ email: str(formData, "email"), password: formData.get("password") ?? "", next: str(formData, "next") });
    if (!parsed.success) return fromZod(parsed.error);
    const { email, password, next } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) return { ok: false, message: "Email or password is incorrect." };

    const slug = await defaultTenantSlug(user.id);
    const ua = (await headers()).get("user-agent");
    await createSession(user.id, null, ua);
    redirect(safeNext(next) ?? (slug ? `/${slug}/dashboard` : "/register"));
}

const registerSchema = z.object({
    workshopName: z.string().min(2, "Enter your workshop name").max(120),
    slug: z
        .string()
        .min(3, "At least 3 characters")
        .max(40)
        .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Lower-case letters, numbers and dashes only"),
    firstName: z.string().min(1, "Required").max(100),
    lastName: z.string().min(1, "Required").max(100),
    email: z.email("Enter a valid email address").transform((s) => s.toLowerCase()),
    password: z.string().min(8, "At least 8 characters").max(200),
    mobile: z.string().max(40).optional(),
    country: z.enum(COUNTRIES as [string, ...string[]]).default("NA"),
});

// "share" is the public document link route, which sits beside the workshop slugs.
const RESERVED_SLUGS = new Set(["login", "register", "api", "admin", "app", "www", "static", "_next", "share", "approve", "join", "portal"]);


export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = registerSchema.safeParse({
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
    if (RESERVED_SLUGS.has(d.slug)) return { ok: false, errors: { slug: ["That address is reserved — pick another"] } };

    const passwordHash = await hashPassword(d.password);
    let userId: string;
    try {
        userId = await prisma.$transaction(async (tx) => {
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
                },
            });
            await tx.membership.create({
                data: { tenantId: tenant.id, userId: user.id, group: "OWNER", isServiceAdvisor: true, dashboardPrivileges: true },
            });
            await createTenantDefaults(tx, tenant.id);
            await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Tenant", entityId: tenant.id, action: "REGISTERED" } });
            return user.id;
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "SLUG_TAKEN") return { ok: false, errors: { slug: ["That workshop address is already taken"] } };
        if (msg === "EMAIL_TAKEN") return { ok: false, errors: { email: ["An account with this email exists — sign in with its password to add a workshop"] } };
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: "That workshop address or email is already in use." };
        throw e;
    }

    const ua = (await headers()).get("user-agent");
    await createSession(userId, null, ua);
    redirect(`/${d.slug}/dashboard`);
}

export async function logoutAction(): Promise<void> {
    await destroySession();
    redirect("/login");
}
