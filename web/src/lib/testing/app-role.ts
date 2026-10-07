import type { PrismaClient } from "@prisma/client";

/**
 * The restricted application role, as the database tests reach it.
 *
 * Row-level security can only be observed from a role that does not bypass
 * it, so the policy tests connect as `motion_app` — and the migrations ship no
 * password for it, because one in a committed file is one in every clone. Each
 * test therefore sets its own.
 *
 * That used to mean three files each setting a *different* password, and the
 * test runner runs files in parallel. Two failure modes followed: Postgres
 * refusing simultaneous edits to the same role ("tuple concurrently updated"),
 * and one file setting a password another had just overwritten, then failing
 * to connect. Both were timing-dependent, so the suite passed until it didn't.
 *
 * One password, shared, means any interleaving leaves the role in the same
 * state. The retry covers the remaining collision, which is two files issuing
 * the identical ALTER at the same instant.
 */
export const APP_ROLE_PASSWORD = "dbtest-app-role-local-only";

export async function prepareAppRole(admin: PrismaClient): Promise<void> {
    for (let attempt = 1; ; attempt++) {
        try {
            await admin.$executeRawUnsafe(`ALTER ROLE motion_app WITH PASSWORD '${APP_ROLE_PASSWORD}'`);
            return;
        } catch (error) {
            const concurrent = error instanceof Error && /tuple concurrently updated/i.test(error.message);
            if (!concurrent || attempt >= 6) throw error;
            await new Promise((r) => setTimeout(r, 50 * attempt));
        }
    }
}

/** The same database the suite is pointed at, reached as `motion_app`. */
export function appRoleUrl(): string {
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.username = "motion_app";
    url.password = APP_ROLE_PASSWORD;
    return url.toString();
}
