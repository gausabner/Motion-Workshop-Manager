import { requireFeature } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { organisation, teamPeople } from "@/lib/requisitions/queries";
import { WorkshopSettings } from "@/components/settings/council/WorkshopSettings";
import { JobCardSignatures } from "@/components/settings/council/JobCardSignatures";
import { CheckBayTemplates } from "@/components/settings/council/CheckBayTemplates";
import { includes } from "@/lib/plans/features";
import { jobFlowSettings } from "@/lib/settings/schema";

export const metadata = { title: "Workshops and bays | MOTION Workshop Manager" };

export default async function WorkshopSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, membership, tenant, plan } = await requireFeature(slug, "requisitions");
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;
    const [org, people, templates] = await Promise.all([
        organisation(db),
        teamPeople(db),
        db.inspectionTemplate.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    ]);
    const flow = jobFlowSettings(tenant.settings);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium">Workshops and bays</h2>
                <p className="text-sm text-slate-500">Where vehicles are: each workshop and bay the council has, who runs it, and its foremen.</p>
            </div>
            <div className="border-t border-slate-200" />
            <WorkshopSettings
                tenant={slug}
                workshops={org.workshops}
                units={org.units.filter((u) => !u.archived).map((u) => ({ id: u.id, label: org.unitLabel(u.id) }))}
                foremen={org.authorities
                    .filter((a): a is typeof a & { workshopId: string } => a.kind === "FOREMAN" && !!a.workshopId)
                    .map((a) => ({ id: a.id, workshopId: a.workshopId, membershipId: a.membershipId, name: a.name, deputy: a.deputy }))}
                people={people.map((p) => ({ id: p.id, name: p.name, designations: p.designationLabels }))}
            />
            {includes(plan, "jobFlow") && (
                <>
                    <JobCardSignatures tenant={slug} issueRoles={flow.issueRoles} />
                    <CheckBayTemplates tenant={slug} templates={templates} assessmentTemplateId={flow.assessmentTemplateId} qualityTemplateId={flow.qualityTemplateId} />
                </>
            )}
        </div>
    );
}
