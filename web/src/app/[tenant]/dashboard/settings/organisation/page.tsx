import { requireFeature } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { organisationSettings } from "@/lib/settings/schema";
import { organisation, teamPeople } from "@/lib/requisitions/queries";
import { OrganisationSettings } from "@/components/settings/council/OrganisationSettings";

export const metadata = { title: "Organisation | MOTION Workshop Manager" };

export default async function OrganisationSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireFeature(slug, "requisitions");
    if (!can(membership, "settings:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="change workshop settings" />;
    const [org, people] = await Promise.all([organisation(db), teamPeople(db)]);
    const levels = organisationSettings(tenant.settings);

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-medium">Organisation</h2>
                <p className="text-sm text-slate-500">The units that own the vehicles and pay for them, who signs for each, and their votes.</p>
            </div>
            <div className="border-t border-slate-200" />
            <OrganisationSettings
                tenant={slug}
                levels={levels}
                units={org.units}
                votes={org.votes}
                appointments={org.authorities
                    .filter((a): a is typeof a & { kind: "DIVISION_HEAD" | "FLEET_COORDINATOR"; orgUnitId: string } => (a.kind === "DIVISION_HEAD" || a.kind === "FLEET_COORDINATOR") && !!a.orgUnitId)
                    .map((a) => ({ id: a.id, kind: a.kind, orgUnitId: a.orgUnitId, membershipId: a.membershipId, name: a.name, deputy: a.deputy }))}
                people={people.map((p) => ({ id: p.id, name: p.name, designations: p.designationLabels }))}
            />
        </div>
    );
}
