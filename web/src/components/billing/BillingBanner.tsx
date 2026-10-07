import Link from "next/link";
import type { Membership, Tenant } from "@prisma/client";
import type { TenantDb } from "@/lib/tenant-db";
import { can } from "@/lib/auth/permissions";
import { billingDay, readOnlyFrom, renewalRules, standing } from "@/lib/billing/periods";

/**
 * The line across the top of every screen when the MOTION subscription needs
 * attention.
 *
 * Read-only is shown to everybody, because everybody meets it — the advisor
 * whose invoice button stops working should not have to ask why. The grace
 * period warning goes to people who can pay, and nobody else: a mechanic
 * cannot do anything about it, and a warning a person cannot act on teaches
 * them to ignore the next one.
 *
 * Nothing is shown while the subscription is current or merely due soon. The
 * reminder email covers that, and a banner on every page a week before every
 * payment is noise.
 */
export async function BillingBanner({ tenant, membership, db }: { tenant: Tenant; membership: Membership; db: TenantDb }) {
    if (tenant.status !== "ACTIVE" && tenant.status !== "PAST_DUE") return null;
    const sub = await db.subscription.findUnique({ where: { tenantId: tenant.id }, select: { status: true, periodEndsAt: true } });
    const end = sub?.status === "ACTIVE" ? sub.periodEndsAt : null;
    const href = `/${tenant.slug}/dashboard/settings/billing`;

    if (tenant.status === "PAST_DUE") {
        return (
            <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-slate-900">
                <span className="font-semibold">MOTION is read-only.</span> The subscription payment{end ? ` due ${billingDay(end)}` : ""} has not
                arrived. You can view, print and export everything; new quotes, job cards and invoices are paused until it is paid.{" "}
                <Link href={href} className="font-medium text-teal-700 underline-offset-2 hover:underline">
                    How to pay
                </Link>
            </div>
        );
    }

    if (!end || !can(membership, "settings:manage")) return null;
    const rules = renewalRules();
    const s = standing(end, new Date(), rules);
    if (s !== "grace" && s !== "overdue") return null;
    return (
        <div role="status" className="mb-4 rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm text-slate-900">
            <span className="font-semibold">Your MOTION subscription was due on {billingDay(end)}.</span> If payment has not arrived by{" "}
            {billingDay(readOnlyFrom(end, rules))}, MOTION becomes read-only for new documents.{" "}
            <Link href={href} className="font-medium text-teal-700 underline-offset-2 hover:underline">
                Payment details
            </Link>
        </div>
    );
}
