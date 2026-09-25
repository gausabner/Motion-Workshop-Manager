import { NextResponse } from "next/server";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { runJournalHandoff } from "@/lib/handoff/run";
import { collectReceipts } from "@/lib/handoff/receipts";

/**
 * Sending a day by hand.
 *
 * The schedule does this unattended; this is the button for the morning after
 * it did not — a missed night, a folder that was not mounted, a day somebody
 * needs to resend because the ERP was rebuilt. It goes through exactly the
 * same runner, so a hand-sent file is byte for byte the one the schedule would
 * have written, and it is recorded as sent by a person rather than by the
 * schedule.
 *
 * `force` is what lets a day be sent twice, and it is deliberately a separate
 * decision from pressing send: the default refuses, because the ordinary cause
 * of somebody pressing this twice is not knowing whether the first one worked.
 */
export async function POST(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership, user } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) return new NextResponse("Not found", { status: 404 });

    const form = await request.formData();
    const day = String(form.get("day") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return new NextResponse("Which day?", { status: 400 });

    const outcome = await runJournalHandoff(db, tenant, {
        day,
        triggeredBy: `${user.firstName} ${user.lastName}`.trim() || user.email,
        force: form.get("force") === "1",
    });
    await collectReceipts(db, tenant);

    const back = new URL(`/${slug}/dashboard/reports/handoff`, request.url);
    back.searchParams.set("sent", outcome.state.toLowerCase());
    if (outcome.error) back.searchParams.set("why", outcome.error.slice(0, 200));
    return NextResponse.redirect(back, { status: 303 });
}
