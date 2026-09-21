import { notFound } from "next/navigation";
import { TeamManager } from "@/components/settings/TeamManager";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listTeam } from "@/lib/team/queries";
import { invitableGroups } from "@/lib/team/rules";

export const metadata = { title: "Team | MOTION Workshop Manager" };

export default async function UsersSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, membership } = await requireTenant(slug);
    if (!can(membership, "users:manage")) notFound();
    const { members, invitations } = await listTeam(db);
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Team</h3>
                <p className="text-sm text-slate-500">Invite your mechanics and service advisors, and choose what each can do.</p>
            </div>
            <div className="border-t border-slate-200" />
            <TeamManager tenant={slug} members={members} invitations={invitations} groups={invitableGroups(membership.group)} selfId={membership.id} />
        </div>
    );
}
