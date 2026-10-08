import { NumberingSettingsForm } from "@/components/settings/NumberingSettingsForm";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { loadNumbering } from "@/lib/settings/numbering";

export const metadata = { title: "Document numbers | MOTION Workshop Manager" };

export default async function NumberingSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { tenant, membership, db } = await requireTenant(slug);
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;

    const rows = await loadNumbering(db, tenant.id);

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Document numbers</h3>
                <p className="text-sm text-slate-500">The prefix and next number on each kind of document you send.</p>
            </div>
            <div className="border-t border-slate-200" />
            <NumberingSettingsForm tenant={slug} rows={rows} />
        </div>
    );
}
