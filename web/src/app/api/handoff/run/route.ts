import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { handoffSettings } from "@/lib/settings/schema";
import { runJournalHandoff } from "@/lib/handoff/run";
import { collectReceipts } from "@/lib/handoff/receipts";
import { businessToday } from "@/lib/tenant/today";
import { authorised } from "@/lib/handoff/authorise";

/**
 * What the scheduler calls at two in the morning.
 *
 * MOTION has no scheduler of its own and deliberately does not grow one. An
 * in-process timer is wrong for every deployment this product has: it fires
 * twice when two containers are running, not at all while one is restarting,
 * and it cannot be made to run at 02:00 in Windhoek by anybody who is not
 * reading the source. What every host already has — cron, a systemd timer, a
 * Kubernetes CronJob, Task Scheduler on the Windows box in a council server
 * room — is something that can make one HTTP request.
 *
 *     curl -fsS -X POST https://motion.example/api/handoff/run \
 *          -H "Authorization: Bearer $HANDOFF_SECRET"
 *
 * The secret is a shared one from the environment rather than a per-workshop
 * API key, because the caller is the host itself acting for every workshop on
 * it, and minting a key per tenant would mean a council adding a line to their
 * crontab each time they opened a branch.
 *
 * It is a POST, and the secret goes in a header rather than the query string,
 * so it does not end up in an access log or a browser history. The comparison
 * is constant-time: this endpoint is reachable from wherever the app is, and a
 * naive comparison leaks the secret a character at a time to anybody patient.
 *
 * Failure is per workshop. One tenant with an unmounted drop folder must not
 * stop the other three from being sent, and the response says which was which
 * so whatever called this can alert on it.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
    if (!authorised(request.headers.get("authorization"), process.env.HANDOFF_SECRET)) {
        return Response.json({ ok: false, error: "not authorised" }, { status: 401, headers: { "cache-control": "no-store" } });
    }

    const url = new URL(request.url);
    // A day can be named, which is how a missed night is filled in later
    // without waiting for the same date to come round again.
    const asked = url.searchParams.get("day");
    const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : null;
    const only = url.searchParams.get("tenant");
    const force = url.searchParams.get("force") === "1";

    // Tenant has no tenantId of its own, so this read is not tenant-scoped —
    // it is the query that decides which tenants there are. Everything after
    // it goes through forTenant and is bound by row-level security as usual.
    const tenants = await prisma.tenant.findMany({
        where: only ? { slug: only } : {},
        select: { id: true, slug: true, name: true, timezone: true, currency: true, settings: true },
    });

    const results: { tenant: string; state: string; rows?: number; file?: string; error?: string; acknowledged?: number }[] = [];

    for (const row of tenants) {
        const settings = handoffSettings(row.settings);
        if (!settings.enabled) continue;

        const db = forTenant(row.id);
        const tenant = await db.tenant.findUnique({ where: { id: row.id } });
        if (!tenant) continue;

        // Yesterday in the workshop's own zone, not the server's. A Windhoek
        // workshop's Monday does not end when a server in Frankfurt says so.
        const target = day ?? new Date(businessToday(tenant.timezone).getTime() - 86_400_000).toISOString().slice(0, 10);

        try {
            const outcome = await runJournalHandoff(db, tenant, { day: target, triggeredBy: "schedule", force });
            // Yesterday's confirmation arrives with today's drop, which is why
            // this runs here rather than on a schedule of its own.
            const receipts = await collectReceipts(db, tenant);
            results.push({
                tenant: row.slug, state: outcome.state, rows: outcome.rows,
                file: outcome.fileName, error: outcome.error, acknowledged: receipts.acknowledged,
            });
        } catch (error) {
            results.push({ tenant: row.slug, state: "FAILED", error: error instanceof Error ? error.message : String(error) });
        }
    }

    const failed = results.filter((r) => r.state === "FAILED");
    return Response.json(
        { ok: failed.length === 0, ran: results.length, failed: failed.length, results },
        // A non-200 when anything failed, so a cron line ending in `|| mail`
        // does what its author expected.
        { status: failed.length === 0 ? 200 : 500, headers: { "cache-control": "no-store" } },
    );
}
