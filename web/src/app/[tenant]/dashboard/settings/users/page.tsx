import { TeamManager } from "@/components/settings/TeamManager";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { listTeam } from "@/lib/team/queries";
import { invitableGroups } from "@/lib/team/rules";
import { includes } from "@/lib/plans/features";
import { GROUP_LABELS } from "@/lib/auth/permissions";
import { teamPeople } from "@/lib/requisitions/queries";
import { ALL_DESIGNATIONS, DESIGNATION_LABEL } from "@/lib/requisitions/organisation";
import { DesignationsPanel } from "@/components/settings/council/DesignationsPanel";

export const metadata = { title: "Team | MOTION Workshop Manager" };

export default async function UsersSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, membership, plan } = await requireTenant(slug);
    if (!can(membership, "users:manage"))
        return <AccessDenied tenant={slug} group={membership.group} needs="manage the team" />;
    const { members, invitations } = await listTeam(db);
    // Designations and pay numbers are what council signatures carry; a workshop without requisitions has no use for them.
    const council = includes(plan, "requisitions") ? await teamPeople(db) : null;
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Team</h3>
                <p className="text-sm text-slate-500">Invite your mechanics and service advisors, and choose what each can do.</p>
            </div>
            <div className="border-t border-slate-200" />
            <TeamManager tenant={slug} members={members} invitations={invitations} groups={invitableGroups(membership.group)} selfId={membership.id} />
            {council && (
                <DesignationsPanel
                    tenant={slug}
                    members={council.map((p) => ({ id: p.id, name: p.name, role: GROUP_LABELS[p.group], designations: p.designations, payNumber: p.payNumber }))}
                    designations={ALL_DESIGNATIONS.map((d) => ({ value: d, label: DESIGNATION_LABEL[d] }))}
                />
            )}
        </div>
    );
}
