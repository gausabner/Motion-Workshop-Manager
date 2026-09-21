import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { requireTenant } from "@/lib/auth/session";
import { fullName } from "@/lib/format";
import { sitesForUser } from "@/lib/sites/queries";

export default async function TenantDashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { user, tenant, membership } = await requireTenant(slug);
    const sites = await sitesForUser(user.id);
    return (
        <DashboardLayout tenant={tenant.slug} workshopName={tenant.name} userName={fullName(user)} group={membership.group} sites={sites}>
            {children}
        </DashboardLayout>
    );
}
