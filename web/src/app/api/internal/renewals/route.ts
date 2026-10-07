import { createHash, timingSafeEqual } from "node:crypto";
import { runRenewalTick } from "@/lib/billing/renewals";

/**
 * The daily renewal run, called by the server's timer and nothing else.
 *
 * Reachable from outside — the tunnel forwards every path — so it is closed
 * by a bearer secret the timer reads from the same environment the app does.
 * Without the secret configured it does not exist: a 404, not a 401, so an
 * installation that never set it up does not advertise the door.
 *
 * The answer is counts only. Which workshops were reminded is in the team's
 * email and the platform audit trail, not in a response body that might end
 * up in a log.
 */
export const dynamic = "force-dynamic";

function digest(s: string): Buffer {
    // Hashed first so the comparison is constant-time whatever the lengths.
    return createHash("sha256").update(s).digest();
}

export async function POST(req: Request): Promise<Response> {
    const secret = process.env.BILLING_TICK_SECRET?.trim();
    if (!secret || secret.length < 32) return new Response(null, { status: 404 });

    const presented = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!timingSafeEqual(digest(presented), digest(secret))) return new Response(null, { status: 404 });

    const summary = await runRenewalTick({ schedulerSecretChecked: true });
    console.info("[renewals] run complete.", summary);
    return Response.json(summary, { headers: { "cache-control": "no-store" } });
}
