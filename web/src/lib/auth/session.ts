import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { requestOrigin } from "@/lib/http/origin";
import { createHash, randomBytes } from "node:crypto";
import type { Membership, Tenant, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forTenant, type TenantDb } from "@/lib/tenant-db";

export const SESSION_COOKIE = "motion_session";
const SESSION_DAYS = 30;

function secret(): string {
    const s = process.env.SESSION_SECRET;
    if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set (see .env.example)");
    return s;
}

function hashToken(token: string): string {
    return createHash("sha256").update(`${token}.${secret()}`).digest("hex");
}

/** Create a DB-backed session and set the cookie. Call from a server action or route handler. */
export async function createSession(userId: string, tenantId: string | null, userAgent?: string | null) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.session.create({
        data: { userId, tenantId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent ?? undefined },
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        // Secure whenever the connection actually is, rather than whenever the
        // build happens to be a production one. `next start` sets production
        // even when serving plain http locally, which marked the cookie Secure
        // over http — Chromium stores that on localhost anyway, WebKit refuses
        // it, and the end-to-end suite could not sign in on an iPhone at all.
        //
        // On Render APP_URL is https, so this is unchanged in production. It is
        // also more correct: the flag now describes the connection instead of
        // the build.
        secure: (await requestOrigin()).startsWith("https://"),
        path: "/",
        expires: expiresAt,
    });
}

export async function destroySession() {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
        await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
        jar.delete(SESSION_COOKIE);
    }
}

export type SessionUser = Pick<User, "id" | "email" | "firstName" | "lastName" | "isSuperuser" | "mustChangePassword">;

/** The signed-in user for this request, or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await prisma.session.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true, isSuperuser: true, mustChangePassword: true } } },
    });
    if (!session || session.expiresAt < new Date()) return null;
    return session.user;
});

/** Redirect to /login unless signed in. */
export async function requireUser(next?: string): Promise<SessionUser> {
    const user = await getSessionUser();
    if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    return user;
}

export type TenantContext = {
    user: SessionUser;
    tenant: Tenant;
    membership: Membership;
    /** Prisma client that can only see this tenant's rows. */
    db: TenantDb;
};

/**
 * The workshop for a `/{slug}/…` route. 404s if the slug does not exist,
 * redirects to /login if signed out, 404s if the user is not an active member
 * (a foreign slug must look like it does not exist).
 */
export const requireTenant = cache(async (slug: string): Promise<TenantContext> => {
    const user = await requireUser(`/${slug}/dashboard`);
    // An account whose password was set by somebody else can reach exactly one
    // screen until it is changed. Enforced here rather than in a layout because
    // this is what every tenant route already passes through, so there is no
    // page that can quietly forget to ask.
    if (user.mustChangePassword) redirect(`/${slug}/change-password`);
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant || !tenant.isActive) notFound();
    const membership = await prisma.membership.findUnique({
        where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    });
    if (!membership || membership.status !== "ACTIVE") notFound();
    return { user, tenant, membership, db: forTenant(tenant.id) };
});

/** First active workshop for a user — where "/" sends them after login. */
export async function defaultTenantSlug(userId: string): Promise<string | null> {
    const m = await prisma.membership.findFirst({
        where: { userId, status: "ACTIVE", tenant: { isActive: true } },
        include: { tenant: { select: { slug: true } } },
        orderBy: { createdAt: "asc" },
    });
    return m?.tenant.slug ?? null;
}
