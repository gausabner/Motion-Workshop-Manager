import { HandoffSettingsForm } from "@/components/settings/HandoffSettingsForm";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { accountingSettings, handoffSettings } from "@/lib/settings/schema";

export const metadata = { title: "Accounting hand-off | MOTION Workshop Manager" };

export default async function HandoffSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Accounting hand-off</h3>
                <p className="text-sm text-slate-500">
                    Every night MOTION can write the day&rsquo;s journal into a folder for the accounting system to pick up. It sends the file out and
                    nothing comes back in — no connection to configure, nothing listening — which is usually the only arrangement a council&rsquo;s
                    network people will agree to.
                </p>
            </div>
            <div className="border-t border-slate-200" />
            <HandoffSettingsForm tenant={slug} handoff={handoffSettings(tenant.settings)} accounting={accountingSettings(tenant.settings)} />
        </div>
    );
}
