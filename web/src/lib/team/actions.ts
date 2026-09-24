"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { invitableGroups } from "@/lib/team/rules";
import { createMemberDirectly, issuePasswordReset } from "@/lib/team/recovery";
import { assertCan, GROUP_LABELS, ALL_GROUPS, GRANTABLE } from "@/lib/auth/permissions";
import { requestOrigin } from "@/lib/http/origin";
import { toInternational } from "@/lib/messaging/phone";
import { MailtoDriver, WhatsAppLinkDriver } from "@/lib/messaging/drivers";
import { createInvitation, revokeInvitation, updateMember } from "@/lib/team/service";



export type InviteResult =
    | { ok: true; link: string; email: string; whatsappUrl?: string; mailtoUrl?: string }
    | { ok: false; message: string };

const inviteSchema = z.object({
    email: z.email("That email does not look right").transform((s) => s.toLowerCase()),
    group: z.enum(ALL_GROUPS),
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
    extraPermissions: z.array(z.enum(GRANTABLE.map((g) => g.permission) as [string, ...string[]])).default([]),
    group: z.enum(ALL_GROUPS),
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

// ───────────────────────── password recovery ─────────────────────────

/**
 * Issue a single-use link that lets somebody set a new password.
 *
 * Owners and admins only — `users:manage` is the same permission that governs
 * adding and removing people, and issuing one of these is the same kind of act.
 * The link is returned to the caller rather than sent: MOTION has no mail
 * provider by design, and the person who forgot their password is almost always
 * standing next to the person who can help.
 *
 * Recorded in the audit trail with who issued it. An owner resetting a
 * bookkeeper's password should leave a mark.
 */
export async function issuePasswordResetAction(
    slug: string,
    membershipId: string,
): Promise<{ ok: boolean; message?: string; url?: string; expiresAt?: string; name?: string }> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "users:manage");
    try {
        const issued = await db.$transaction(async (tx) => {
            const result = await issuePasswordReset(tx, tenant.id, membership, membershipId);
            await tx.auditEvent.create({
                data: {
                    tenantId: tenant.id,
                    actorUserId: user.id,
                    entityType: "Membership",
                    entityId: membershipId,
                    action: "PASSWORD_RESET_ISSUED",
                    diff: { expiresAt: result.expiresAt.toISOString() },
                },
            });
            return result;
        });
        revalidatePath(teamPath(slug));
        return {
            ok: true,
            url: `${await requestOrigin()}/${slug}/reset/${issued.token}`,
            expiresAt: issued.expiresAt.toISOString(),
            name: issued.name,
        };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That link was not created" };
    }
}

/**
 * Add somebody without an invitation: the owner fills in the details and either
 * types a first password or takes a link away.
 *
 * Not everyone in a workshop has an email address they check, and an apprentice
 * starting this morning should not wait for one.
 */
export async function createMemberAction(
    slug: string,
    input: {
        email: string; firstName: string; lastName: string; mobile?: string;
        group: string; mode: "password" | "link"; password?: string;
    },
): Promise<{ ok: boolean; message?: string; url?: string; name?: string }> {
    const { db, tenant, membership, user } = await requireTenant(slug);
    assertCan(membership, "users:manage");

    const parsed = z.object({
        email: z.email("Enter a valid email address"),
        firstName: z.string().min(1, "Enter a first name"),
        lastName: z.string().min(1, "Enter a last name"),
        mobile: z.string().optional(),
        group: z.enum(ALL_GROUPS),
        mode: z.enum(["password", "link"]),
        password: z.string().min(8, "A first password needs at least 8 characters").optional(),
    }).refine((v) => v.mode !== "password" || !!v.password, {
        path: ["password"], message: "Type a first password, or choose a link instead",
    }).safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the details" };

    if (!invitableGroups(membership.group).includes(parsed.data.group)) {
        return { ok: false, message: "Only an owner can add another owner." };
    }

    try {
        const created = await db.$transaction(async (tx) => {
            const result = await createMemberDirectly(tx, tenant.id, membership, {
                ...parsed.data,
                password: parsed.data.mode === "password" ? parsed.data.password : undefined,
            });
            await tx.auditEvent.create({
                data: {
                    tenantId: tenant.id, actorUserId: user.id, entityType: "Membership",
                    entityId: result.membershipId, action: "CREATED",
                    diff: { group: parsed.data.group, how: parsed.data.mode },
                },
            });
            return result;
        });
        revalidatePath(teamPath(slug));
        return {
            ok: true,
            name: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
            url: created.token ? `${await requestOrigin()}/${slug}/reset/${created.token}` : undefined,
        };
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "That person was not added" };
    }
}
