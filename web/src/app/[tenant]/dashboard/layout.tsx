import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { requireTenant } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { sitesForUser } from "@/lib/sites/queries";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { featuresOf } from "@/lib/plans/features";

/**
 * No parallel `@sheet` slot here any more. An intercepted `(.)customers/[id]`
 * route used to open a customer over the list, and it also caught
 * `/customers/new` — "new" taken for a customer id, then "page not found" —
 * and "Open the full customer", which re-entered the sheet. A summary over a
 * list is now a search parameter on the list page itself (see
 * `customers/page.tsx`), so every path under a list is the real page.
 */
export default async function TenantDashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { user, tenant, membership, db, plan } = await requireTenant(slug);
    const sites = await sitesForUser(user.id);
    return (
        <DashboardLayout tenant={tenant.slug} workshopName={tenant.name} userName={fullName(user)} group={membership.group} sites={sites} features={featuresOf(plan)}>
            <BillingBanner tenant={tenant} membership={membership} db={db} />
            {children}
        </DashboardLayout>
    );
}
