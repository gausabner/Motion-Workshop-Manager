import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { requireTenant } from "@/lib/auth/session";
import { fullName } from "@/lib/format";

export default async function TenantDashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { user, tenant, membership } = await requireTenant(slug);
    return (
        <DashboardLayout tenant={tenant.slug} workshopName={tenant.name} userName={fullName(user)} group={membership.group}>
            {children}
        </DashboardLayout>
    );
}
