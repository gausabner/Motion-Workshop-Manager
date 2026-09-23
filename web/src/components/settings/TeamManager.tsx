"use client";

import { useState, useTransition } from "react";
import type { UserGroup } from "@prisma/client";
import { Copy, MessageCircle, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GROUP_LABELS } from "@/lib/auth/permissions";
import { inviteMemberAction, revokeInvitationAction, updateMemberAction, type InviteResult } from "@/lib/team/actions";
import type { PendingInvitation, TeamMember } from "@/lib/team/queries";

const field = "h-8 rounded-md border border-slate-300 px-2 text-sm bg-white";
const heading = "text-[11px] font-semibold uppercase tracking-wider text-slate-500";

/**
 * The team, for real: who is in the workshop, what they may do, and who is on
 * the diary. New people join by a link the owner sends from their own phone.
 */
export function TeamManager({
    tenant, members, invitations, groups, selfId,
}: { tenant: string; members: TeamMember[]; invitations: PendingInvitation[]; groups: UserGroup[]; selfId: string }) {
    return (
        <div className="space-y-6 max-w-4xl">
            <Invite tenant={tenant} groups={groups} />
            {invitations.length > 0 && (
                <section className="border border-slate-200 rounded-sm bg-white">
                    <h3 className={`${heading} px-4 py-2 border-b bg-slate-50`}>Waiting to join</h3>
                    <ul className="divide-y divide-slate-100">
                        {invitations.map((i) => <InvitationRow key={i.id} tenant={tenant} invitation={i} />)}
                    </ul>
                </section>
            )}
            <section className="border border-slate-200 rounded-sm bg-white">
                <h3 className={`${heading} px-4 py-2 border-b bg-slate-50`}>Team</h3>
                <div className="grid grid-cols-12 gap-2 px-4 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <span className="col-span-4">Person</span><span className="col-span-3">Role</span><span className="col-span-4">Works as</span>
                </div>
                <ul className="divide-y divide-slate-100">
                    {members.map((m) => <MemberRow key={m.id} tenant={tenant} member={m} groups={groups} isSelf={m.id === selfId} />)}
                </ul>
                <p className="px-4 py-2 border-t text-[11px] text-slate-400">
                    Mechanics clock on from their phones and can be given jobs. &ldquo;On diary&rdquo; gives someone a lane in the booking diary. Switching someone off keeps everything they did, but they can no longer sign in to this workshop.
                </p>
            </section>
        </div>
    );
}

function Invite({ tenant, groups }: { tenant: string; groups: UserGroup[] }) {
    const [result, setResult] = useState<InviteResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [pending, start] = useTransition();
    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <h3 className={`${heading} px-4 py-2 border-b bg-slate-50`}>Add someone</h3>
            <form
                className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12 sm:items-end sm:gap-2"
                action={(fd) => start(async () => {
                    setCopied(false);
                    setResult(await inviteMemberAction(tenant, {
                        email: String(fd.get("email") ?? ""), group: String(fd.get("group") ?? ""), mobile: String(fd.get("mobile") ?? "") || undefined,
                    }));
                })}
            >
                <label className="space-y-1 text-xs text-slate-500 sm:col-span-4"><span>Email</span><input name="email" type="email" required className={`${field} w-full`} placeholder="name@example.com" /></label>
                <label className="space-y-1 text-xs text-slate-500 sm:col-span-3"><span>Role</span>
                    <select name="group" defaultValue="MECHANIC" className={`${field} w-full`}>
                        {groups.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                    </select>
                </label>
                <label className="space-y-1 text-xs text-slate-500 sm:col-span-3"><span>Mobile (optional, for WhatsApp)</span><input name="mobile" type="tel" className={`${field} w-full`} /></label>
                <div className="flex sm:col-span-2 sm:justify-end">
                    <Button type="submit" className="h-11 w-full bg-teal-600 hover:bg-teal-700 sm:h-8 sm:w-auto" disabled={pending}><UserPlus className="w-3.5 h-3.5 mr-1" />{pending ? "…" : "Invite"}</Button>
                </div>
            </form>
            {result && !result.ok && <p className="px-4 pb-3 text-xs text-red-600" role="alert">{result.message}</p>}
            {result?.ok && (
                <div className="mx-4 mb-3 rounded-sm border border-teal-200 bg-teal-50 p-3 space-y-2">
                    <p className="text-sm text-teal-900">Invitation ready for {result.email}. Send it from your phone — it works once, for 7 days.</p>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => { void navigator.clipboard?.writeText(result.link).then(() => setCopied(true)); }}>
                            <Copy className="w-3.5 h-3.5 mr-1" />{copied ? "Copied" : "Copy link"}
                        </Button>
                        {result.whatsappUrl && <a href={result.whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium"><MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp</a>}
                        {result.mailtoUrl && <a href={result.mailtoUrl} className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium"><Mail className="w-3.5 h-3.5 mr-1" />Email</a>}
                    </div>
                    <input readOnly value={result.link} className={`${field} w-full font-mono text-xs`} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />
                </div>
            )}
        </section>
    );
}

function InvitationRow({ tenant, invitation }: { tenant: string; invitation: PendingInvitation }) {
    const [pending, start] = useTransition();
    return (
        <li className="flex items-center justify-between px-4 py-2 text-sm">
            <span>
                <span className="font-medium text-slate-700">{invitation.email}</span>
                <span className="text-slate-400"> · {GROUP_LABELS[invitation.group]} · invited by {invitation.invitedBy.firstName}, link valid until {invitation.expiresAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
            </span>
            <Button type="button" size="sm" variant="outline" className="h-7" disabled={pending} onClick={() => start(() => revokeInvitationAction(tenant, invitation.id))}>Cancel invite</Button>
        </li>
    );
}

function MemberRow({ tenant, member, groups, isSelf }: { tenant: string; member: TeamMember; groups: UserGroup[]; isSelf: boolean }) {
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [pending, start] = useTransition();
    const inactive = member.status !== "ACTIVE";
    const editableGroups = groups.includes(member.group) ? groups : [member.group, ...groups];
    return (
        <li className={inactive ? "bg-slate-50" : undefined}>
            <form
                className="grid grid-cols-12 items-center gap-2 px-4 py-2"
                action={(fd) => start(async () => {
                    const result = await updateMemberAction(tenant, member.id, {
                        group: String(fd.get("group")) as UserGroup,
                        status: fd.get("active") === "on" ? "ACTIVE" : "INACTIVE",
                        isMechanic: fd.get("isMechanic") === "on",
                        showOnDiary: fd.get("showOnDiary") === "on",
                        isServiceAdvisor: fd.get("isServiceAdvisor") === "on",
                    });
                    setMessage(result.ok ? { ok: true, text: "Saved" } : { ok: false, text: result.message ?? "Not saved" });
                })}
            >
                <div className="col-span-4 min-w-0">
                    <p className={`text-sm font-medium truncate ${inactive ? "text-slate-400" : "text-slate-800"}`}>{member.user.firstName} {member.user.lastName}{isSelf && <span className="text-slate-400 font-normal"> (you)</span>}</p>
                    <p className="text-xs text-slate-400 truncate">{member.user.email}</p>
                </div>
                <select name="group" defaultValue={member.group} disabled={isSelf} className={`${field} col-span-3`} aria-label="Role">
                    {editableGroups.map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
                </select>
                {isSelf && <input type="hidden" name="group" value={member.group} />}
                <div className="col-span-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    <label className="flex items-center gap-1"><input type="checkbox" name="isMechanic" defaultChecked={member.isMechanic} className="accent-teal-600" />Mechanic</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="showOnDiary" defaultChecked={member.showOnDiary} className="accent-teal-600" />On diary</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="isServiceAdvisor" defaultChecked={member.isServiceAdvisor} className="accent-teal-600" />Advisor</label>
                    <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={!inactive} disabled={isSelf} className="accent-teal-600" />Active</label>
                    {isSelf && <input type="hidden" name="active" value="on" />}
                </div>
                <div className="col-span-1 flex justify-end">
                    <Button type="submit" size="sm" variant="outline" className="h-7" disabled={pending}>{pending ? "…" : "Save"}</Button>
                </div>
                {message && <p className={`col-span-12 text-xs ${message.ok ? "text-teal-700" : "text-red-600"}`} role={message.ok ? undefined : "alert"}>{message.text}</p>}
            </form>
        </li>
    );
}
