"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan, GROUP_LABELS } from "@/lib/auth/permissions";
import { requestOrigin } from "@/lib/http/origin";
import { toInternational } from "@/lib/messaging/phone";
import { MailtoDriver, WhatsAppLinkDriver } from "@/lib/messaging/drivers";
import { createInvitation, revokeInvitation, updateMember } from "@/lib/team/service";

const GROUPS = ["OWNER", "ADMIN", "SERVICE_ADVISOR", "MECHANIC", "INVOICE_PAY", "READ_ONLY"] as const;

export type InviteResult =
    | { ok: true; link: string; email: string; whatsappUrl?: string; mailtoUrl?: string }
    | { ok: false; message: string };

const inviteSchema = z.object({
    email: z.email("That email does not look right").transform((s) => s.toLowerCase()),
    group: z.enum(GROUPS),
    mobile: z.string().trim().max(40).optional(),
});

const teamPath = (slug: string) => `/${slug}/dashboard/settings/users`;

export async function inviteMemberAction(slug: string, input: { email: string; group: string; mobile?: string }): Promise<InviteResult> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "users:manage");
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details" };
    try {
        const { token } = await db.$transaction((tx) => createInvitation(tx, tenant.id, membership, parsed.data));
        const link = `${(await requestOrigin()).replace(/\/$/, "")}/join/${token}`;
        const body = `${user.firstName} has added you to ${tenant.name} on MOTION as ${GROUP_LABELS[parsed.data.group]}. Set up your sign-in here (the link works for 7 days): ${link}`;
        const phone = toInternational(parsed.data.mobile, tenant.country);
        const [wa, mail] = await Promise.all([
            phone ? new WhatsAppLinkDriver().send({ channel: "WHATSAPP", recipient: phone, body }) : null,
            new MailtoDriver().send({ channel: "EMAIL", recipient: parsed.data.email, subject: `Join ${tenant.name} on MOTION`, body }),
        ]);
        revalidatePath(teamPath(slug));
        return {
            ok: true,
            link,
            email: parsed.data.email,
            whatsappUrl: wa?.kind === "handoff" ? wa.url : undefined,
            mailtoUrl: mail.kind === "handoff" ? mail.url : undefined,
        };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The invitation was not created" };
    }
}

export async function revokeInvitationAction(slug: string, invitationId: string): Promise<void> {
    const { db, membership } = await requireTenant(slug);
    assertCan(membership, "users:manage");
    await db.$transaction((tx) => revokeInvitation(tx, invitationId));
    revalidatePath(teamPath(slug));
}

const memberSchema = z.object({
    group: z.enum(GROUPS),
    status: z.enum(["ACTIVE", "INACTIVE"]),
    isMechanic: z.boolean(),
    showOnDiary: z.boolean(),
    isServiceAdvisor: z.boolean(),
});

export async function updateMemberAction(slug: string, membershipId: string, input: z.input<typeof memberSchema>): Promise<{ ok: boolean; message?: string }> {
    const { db, tenant, membership } = await requireTenant(slug);
    assertCan(membership, "users:manage");
    const parsed = memberSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Check the details" };
    try {
        await db.$transaction((tx) => updateMember(tx, tenant.id, membership, membershipId, parsed.data));
        revalidatePath(teamPath(slug));
        revalidatePath(`/${slug}/dashboard/schedule`);
        return { ok: true };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That change was not saved" };
    }
}
