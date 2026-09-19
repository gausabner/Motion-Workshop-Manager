"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/auth/session";
import { assertCan } from "@/lib/auth/permissions";
import { requestOrigin } from "@/lib/http/origin";
import { campaignSchema, filtersSchema, reachFor, type AudienceFilters, type CampaignInput } from "@/lib/campaigns/audience";
import { findAudience } from "@/lib/campaigns/queries";
import { createCampaign, deleteCampaign, finishCampaign, sendToRecipient, skipRecipient, type SendResult } from "@/lib/campaigns/service";

const base = (slug: string) => `/${slug}/dashboard/messages`;

async function sender(slug: string) {
    const ctx = await requireTenant(slug);
    assertCan(ctx.membership, "messages:send");
    return ctx;
}

export type AudiencePreview = {
    total: number;
    reachable: number;
    sample: { name: string; vehicle: string | null; owing: number }[];
    leftOut: { reason: string; count: number }[];
};

/** How many the current audience comes to, before anyone commits to sending. */
export async function previewAudienceAction(slug: string, filters: unknown, channel: "WHATSAPP" | "EMAIL", usePreferred: boolean): Promise<AudiencePreview> {
    const { db, tenant } = await sender(slug);
    const parsed = filtersSchema.safeParse(filters);
    if (!parsed.success) return { total: 0, reachable: 0, sample: [], leftOut: [{ reason: parsed.error.issues[0]?.message ?? "Check the audience", count: 0 }] };
    const audience = await findAudience(db, tenant, parsed.data);
    const reasons = new Map<string, number>();
    let reachable = 0;
    for (const member of audience) {
        const reach = reachFor(member, channel, usePreferred, tenant.country);
        if (reach.ok) reachable++;
        else reasons.set(reach.reason, (reasons.get(reach.reason) ?? 0) + 1);
    }
    return {
        total: audience.length,
        reachable,
        sample: audience.slice(0, 8).map((m) => ({ name: `${m.firstName} ${m.lastName}`.trim(), vehicle: m.vehicle, owing: m.owing })),
        leftOut: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    };
}

export async function createCampaignAction(slug: string, input: CampaignInput, filters: AudienceFilters): Promise<{ ok: false; message: string }> {
    const { db, tenant, membership } = await sender(slug);
    const campaign = campaignSchema.safeParse(input);
    if (!campaign.success) return { ok: false, message: campaign.error.issues[0]?.message ?? "Check the message" };
    const audience = filtersSchema.safeParse(filters);
    if (!audience.success) return { ok: false, message: audience.error.issues[0]?.message ?? "Check the audience" };
    let id: string;
    try {
        const created = await db.$transaction((tx) => createCampaign(tx, db, tenant, membership.id, campaign.data, audience.data), { timeout: 20_000 });
        id = created.id;
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "The campaign was not created" };
    }
    revalidatePath(base(slug));
    redirect(`${base(slug)}/${id}`);
}

export async function sendRecipientAction(slug: string, recipientId: string): Promise<SendResult> {
    const ctx = await sender(slug);
    const result = await sendToRecipient(ctx, await requestOrigin(), recipientId);
    revalidatePath(base(slug), "layout");
    return result;
}

export async function skipRecipientAction(slug: string, recipientId: string): Promise<void> {
    const { db } = await sender(slug);
    await db.$transaction((tx) => skipRecipient(tx, recipientId));
    revalidatePath(base(slug), "layout");
}

export async function finishCampaignAction(slug: string, campaignId: string): Promise<void> {
    const { db } = await sender(slug);
    await db.$transaction((tx) => finishCampaign(tx, campaignId));
    revalidatePath(base(slug), "layout");
}

export async function deleteCampaignAction(slug: string, campaignId: string): Promise<{ ok: boolean; message?: string }> {
    const { db } = await sender(slug);
    try {
        await db.$transaction((tx) => deleteCampaign(tx, campaignId));
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Not deleted" };
    }
    revalidatePath(base(slug));
    redirect(base(slug));
}
