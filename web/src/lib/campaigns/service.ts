import "server-only";
import type { MessageChannel, Tenant } from "@prisma/client";
import type { TenantContext } from "@/lib/auth/session";
import type { TenantDb, TenantTx } from "@/lib/tenant-db";
import { driverFor } from "@/lib/messaging/drivers";
import { renderTemplate } from "@/lib/templates/merge";
import { workshopValues } from "@/lib/templates/values";
import { mintShareLink, shareUrl } from "@/lib/sharing/links";
import { portalSettings } from "@/lib/settings/schema";
import { findAudience } from "@/lib/campaigns/queries";
import { reachFor, type AudienceFilters, type CampaignInput } from "@/lib/campaigns/audience";

/**
 * Bulk messages, sent one at a time.
 *
 * WhatsApp goes out from the sender's own phone, so a campaign is a work
 * queue rather than a blast: the audience is worked out once and frozen as
 * recipients, and each one is sent, skipped or left pending. That also means a
 * half-finished campaign can be picked up later exactly where it stopped.
 */

const hasLink = (body: string) => /\{\{\s*link\s*\}\}/i.test(body);

export async function createCampaign(
    tx: TenantTx,
    db: TenantDb,
    tenant: Tenant,
    membershipId: string,
    input: CampaignInput,
    filters: AudienceFilters,
): Promise<{ id: string; recipients: number }> {
    const audience = await findAudience(db, tenant, filters);
    if (audience.length === 0) throw new Error("Nobody matches that audience, so there is nothing to send.");
    const campaign = await tx.campaign.create({
        data: {
            tenantId: tenant.id, name: input.name, channel: input.channel, usePreferred: input.usePreferred,
            subject: input.subject || null, body: input.body, filters, createdById: membershipId,
        },
        select: { id: true },
    });
    for (const member of audience) {
        const reach = reachFor(member, input.channel, input.usePreferred, tenant.country);
        await tx.campaignRecipient.create({
            data: {
                tenantId: tenant.id, campaignId: campaign.id, customerId: member.id,
                // Someone with no way to receive it is in the list as left out, with the reason, rather than quietly missing.
                state: reach.ok ? "PENDING" : "SKIPPED",
                note: reach.ok ? null : reach.reason,
            },
        });
    }
    return { id: campaign.id, recipients: audience.length };
}

export type SendResult = { ok: true; url: string | null; channel: MessageChannel } | { ok: false; message: string };

/**
 * One customer of a campaign. The message is worded per customer, and
 * `{{link}}` becomes that customer's own portal link — the one thing a bulk
 * message cannot be written with in advance.
 */
export async function sendToRecipient(ctx: TenantContext, origin: string, recipientId: string): Promise<SendResult> {
    const { db, tenant, membership, user } = ctx;
    const recipient = await db.campaignRecipient.findUnique({
        where: { id: recipientId },
        select: {
            id: true, state: true,
            campaign: { select: { id: true, channel: true, usePreferred: true, subject: true, body: true, name: true } },
            customer: { select: { id: true, firstName: true, lastName: true, mobile: true, email: true, preferredContact: true, archivedAt: true, vehicles: { where: { archivedAt: null }, take: 1, orderBy: { createdAt: "asc" }, select: { year: true, make: true, model: true, plate: true } } } },
        },
    });
    if (!recipient) return { ok: false, message: "That recipient is no longer in this campaign." };
    if (recipient.state === "SENT") return { ok: false, message: "This one has already been sent." };
    const { campaign, customer } = recipient;
    if (customer.archivedAt) return { ok: false, message: "That customer has been archived." };

    const reach = reachFor(customer, campaign.channel, campaign.usePreferred, tenant.country);
    if (!reach.ok) {
        await db.campaignRecipient.update({ where: { id: recipient.id }, data: { state: "SKIPPED", note: reach.reason, actedAt: new Date() } });
        return { ok: false, message: reach.reason };
    }

    // The portal link is minted per customer, and only when the message asks for one.
    let link = "";
    let shareLinkId: string | null = null;
    const portal = portalSettings(tenant.settings);
    if (hasLink(campaign.body)) {
        if (!portal.enabled) return { ok: false, message: "The message has a link in it, but the customer portal is switched off." };
        const minted = await db.$transaction((tx) => mintShareLink(tx, { tenantId: tenant.id, kind: "PORTAL", targetId: customer.id, createdById: membership.id, days: portal.linkDays }));
        link = shareUrl(origin, minted.token, "PORTAL");
        shareLinkId = minted.id;
    }

    const vehicle = customer.vehicles[0];
    const body = renderTemplate(campaign.body, {
        ...workshopValues(tenant),
        customer_name: `${customer.firstName} ${customer.lastName}`.trim(),
        customer_first_name: customer.firstName,
        customer_mobile: customer.mobile ?? "",
        vehicle: vehicle ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") : "",
        plate: vehicle?.plate ?? "",
        link,
    });
    if (!body.trim()) return { ok: false, message: "The message came out empty for this customer." };

    const driver = driverFor(reach.channel);
    const subject = reach.channel === "EMAIL" ? campaign.subject || campaign.name : undefined;
    const result = await driver.send({ channel: reach.channel, recipient: reach.recipient, subject, body });
    const status = result.kind === "handoff" ? "HANDED_OFF" : result.kind === "sent" ? "SENT" : "FAILED";

    await db.$transaction(async (tx) => {
        const message = await tx.message.create({
            data: {
                tenantId: tenant.id, customerId: customer.id, shareLinkId, channel: reach.channel, driver: driver.name, status,
                recipient: reach.recipient, subject: subject ?? null, body,
                externalId: result.kind === "sent" ? result.externalId : null,
                error: result.kind === "failed" ? result.error : null,
                sentById: membership.id,
            },
            select: { id: true },
        });
        await tx.campaignRecipient.update({
            where: { id: recipient.id },
            data: { state: status === "FAILED" ? "FAILED" : "SENT", messageId: message.id, note: result.kind === "failed" ? result.error : null, actedAt: new Date() },
        });
        await tx.campaign.update({ where: { id: campaign.id }, data: { state: "SENDING" } });
        await tx.auditEvent.create({ data: { tenantId: tenant.id, actorUserId: user.id, entityType: "Campaign", entityId: campaign.id, action: "SENT", diff: { customerId: customer.id, channel: reach.channel } } });
    });

    if (result.kind === "failed") return { ok: false, message: result.error };
    return { ok: true, url: result.kind === "handoff" ? result.url : null, channel: reach.channel };
}

export async function skipRecipient(tx: TenantTx, recipientId: string, note = "Skipped"): Promise<void> {
    await tx.campaignRecipient.updateMany({ where: { id: recipientId, state: "PENDING" }, data: { state: "SKIPPED", note, actedAt: new Date() } });
}

/** Stop here: everyone still waiting is left out, and the campaign is closed. */
export async function finishCampaign(tx: TenantTx, campaignId: string): Promise<void> {
    await tx.campaignRecipient.updateMany({ where: { campaignId, state: "PENDING" }, data: { state: "SKIPPED", note: "Campaign closed", actedAt: new Date() } });
    await tx.campaign.update({ where: { id: campaignId }, data: { state: "DONE" } });
}

/** A campaign nobody has been sent yet can go entirely; once a message has gone out it stays as a record. */
export async function deleteCampaign(tx: TenantTx, campaignId: string): Promise<void> {
    const sent = await tx.campaignRecipient.count({ where: { campaignId, state: { in: ["SENT", "FAILED"] } } });
    if (sent > 0) throw new Error("Messages have gone out on this campaign, so it stays as a record. Close it instead.");
    await tx.campaign.delete({ where: { id: campaignId } });
}
