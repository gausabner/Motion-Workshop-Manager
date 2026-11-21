import { requireFeature } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { requisitionSettings } from "@/lib/settings/schema";
import { organisation, teamPeople } from "@/lib/requisitions/queries";
import { RequisitionRules } from "@/components/settings/council/RequisitionRules";

export const metadata = { title: "Requisition rules | MOTION Workshop Manager" };

export default async function RequisitionRulesPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireFeature(slug, "requisitions");
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;
    const [org, people] = await Promise.all([organisation(db), teamPeople(db)]);

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-medium">Requisition rules</h2>
                <p className="text-sm text-slate-500">The value limit, the quotations a purchase needs, and who approves above the limit.</p>
            </div>
            <div className="border-t border-slate-200" />
            <RequisitionRules
                tenant={slug}
                currency={tenant.currency}
                rules={requisitionSettings(tenant.settings)}
                approvers={org.authorities.filter((a) => a.kind === "OVER_LIMIT").map((a) => ({ id: a.id, membershipId: a.membershipId, name: a.name, deputy: a.deputy }))}
                people={people.map((p) => ({ id: p.id, name: p.name, designations: p.designationLabels }))}
            />
        </div>
    );
}
