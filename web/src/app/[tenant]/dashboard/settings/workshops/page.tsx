import { requireFeature } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { organisation, teamPeople } from "@/lib/requisitions/queries";
import { WorkshopSettings } from "@/components/settings/council/WorkshopSettings";
import { JobCardSignatures } from "@/components/settings/council/JobCardSignatures";
import { CheckBayTemplates } from "@/components/settings/council/CheckBayTemplates";
import { includes } from "@/lib/plans/features";
import { jobFlowSettings } from "@/lib/settings/schema";
import { fullName } from "@/lib/format";
import { STAFF_ROLE_LABEL, isStaffRole } from "@/lib/fleet/crew-rules";

export const metadata = { title: "Workshops and bays | MOTION Workshop Manager" };

export default async function WorkshopSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, membership, tenant, plan } = await requireFeature(slug, "requisitions");
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;
    const [org, people, templates, staff] = await Promise.all([
        organisation(db),
        teamPeople(db),
        db.inspectionTemplate.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
        db.workshopStaff.findMany({
            where: { membership: { status: "ACTIVE" } },
            orderBy: { createdAt: "asc" },
            select: { id: true, workshopId: true, membershipId: true, role: true, membership: { select: { user: { select: { firstName: true, lastName: true } } } } },
        }),
    ]);
    const flow = jobFlowSettings(tenant.settings);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-medium">Workshops and bays</h2>
                <p className="text-sm text-slate-500">Where vehicles are: each workshop and bay your organisation has, who runs it, its foremen, and who works there.</p>
            </div>
            <div className="border-t border-slate-200" />
            <WorkshopSettings
                tenant={slug}
                workshops={org.workshops}
                units={org.units.filter((u) => !u.archived).map((u) => ({ id: u.id, label: org.unitLabel(u.id) }))}
                foremen={org.authorities
                    .filter((a): a is typeof a & { workshopId: string } => a.kind === "FOREMAN" && !!a.workshopId)
                    .map((a) => ({ id: a.id, workshopId: a.workshopId, membershipId: a.membershipId, name: a.name, deputy: a.deputy }))}
                staff={staff.map((s) => ({ id: s.id, workshopId: s.workshopId, membershipId: s.membershipId, name: fullName(s.membership.user), deputy: false, note: isStaffRole(s.role) ? STAFF_ROLE_LABEL[s.role] : undefined }))}
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
