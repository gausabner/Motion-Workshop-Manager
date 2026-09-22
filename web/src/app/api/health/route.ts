import { prisma } from "@/lib/db";

/**
 * What a load balancer asks before sending anybody here.
 *
 * It checks the database, because a MOTION that cannot reach Postgres is not
 * usable for anything — every screen is somebody's books — and a process that
 * answers "fine" while the database is gone is worse than one that admits it.
 *
 * It says nothing else. An endpoint reachable without a key tells the world
 * only whether to send traffic: no version, no host, no schema, no counts.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
    const started = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return Response.json(
            { ok: true, database: "up", ms: Date.now() - started },
            { headers: { "cache-control": "no-store" } },
        );
    } catch {
        // Deliberately not the error: it would name the host, the user and the port.
        return Response.json(
            { ok: false, database: "down" },
            { status: 503, headers: { "cache-control": "no-store" } },
        );
    }
}
