import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { buildBundle } from "@/lib/handoff/bundle";
import { recordExport } from "@/lib/exports/record";
import { safeFileName } from "@/lib/storage";

/**
 * Everything the workshop has, as one archive.
 *
 * Gated on `settings:manage` rather than on `reports:view`, which is stricter
 * than any other export here. The plan settled this: the bundle is owner
 * self-service. Every other file in MOTION is a slice somebody needs to do
 * their job; this one is the lot, contact details and all, and the person who
 * should be able to take it is the person who could already change who has
 * access to it.
 *
 * Audited like every other download, and for this one that record is the
 * point. "Who took a complete copy of the customer list, and when" is the
 * question a council asks after somebody leaves, and it is the question this
 * market's incumbents cannot answer at all.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership, user } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) return new NextResponse("Not found", { status: 404 });

    const at = new Date();
    const { body, tables, rows } = await buildBundle(db, tenant, at);

    await recordExport(db, tenant.id, user.id, { report: "Everything", format: "csv", rows });

    const name = safeFileName(`${tenant.slug}-everything-${at.toISOString().slice(0, 10)}.zip`, "everything.zip");
    return new NextResponse(body as unknown as BodyInit, {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${name}"`,
            "Content-Length": String(body.length),
            // The count is on the response so a truncated download can be told
            // from a small workshop without opening the archive.
            "X-Motion-Tables": String(tables.length),
            "Cache-Control": "private, no-store",
        },
    });
}
