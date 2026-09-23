import { PortalSettingsForm } from "@/components/settings/PortalSettingsForm";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { portalSettings } from "@/lib/settings/schema";

export const metadata = { title: "Customer portal | MOTION Workshop Manager" };

export default async function PortalSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Customer portal</h3>
                <p className="text-sm text-slate-500">A private page for each customer: what they owe, their vehicles&rsquo; dates, and anything waiting for their go-ahead. No accounts or passwords — each customer&rsquo;s link is their key. Open any customer and use &ldquo;View as customer&rdquo; to see exactly what they will see.</p>
            </div>
            <div className="border-t border-slate-200" />
            <PortalSettingsForm tenant={slug} settings={portalSettings(tenant.settings)} />
        </div>
    );
}
