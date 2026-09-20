import { withKey } from "@/lib/api/auth";
import { json } from "@/lib/api/http";
import { RATE_LIMIT } from "@/lib/api/keys";

/**
 * The first call anybody makes. It answers "is this key live, whose workshop is
 * it, and what may it do" — which is what an integrator needs before writing
 * anything else, and what a workshop needs to check a key still works.
 */
export const GET = withKey("READ", async (caller) =>
    json({
        workshop: { name: caller.tenant.name, currency: caller.tenant.currency, timezone: caller.tenant.timezone },
        scopes: caller.scopes,
        rateLimit: { requests: RATE_LIMIT.requests, perSeconds: RATE_LIMIT.windowSeconds },
        version: "v1",
    }),
);
