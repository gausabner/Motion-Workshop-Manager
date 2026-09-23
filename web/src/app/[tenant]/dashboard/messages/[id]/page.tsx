import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { getCampaign } from "@/lib/campaigns/queries";
import { describeAudience, filtersSchema } from "@/lib/campaigns/audience";
import { CampaignQueue } from "@/components/campaigns/CampaignQueue";
import { dateShortIn } from "@/lib/format";

export const metadata = { title: "Campaign | MOTION Workshop Manager" };

export default async function CampaignPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "messages:send"))
        return <AccessDenied tenant={slug} group={membership.group} needs="send messages to customers" />;
    const campaign = await getCampaign(db, id);
    if (!campaign) notFound();
    const sources = await db.customerSource.findMany({ select: { id: true, name: true } });
    const filters = filtersSchema.safeParse(campaign.filters);
    const description = filters.success ? describeAudience(filters.data, new Map(sources.map((s) => [s.id, s.name]))) : [];

    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/messages`} className="text-xs font-medium text-teal-700 hover:underline">← Messages</Link>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">{campaign.name}</h1>
                <p className="text-sm text-slate-500">
                    {campaign.usePreferred ? "Each customer's preferred way" : campaign.channel === "EMAIL" ? "Email" : "WhatsApp"} · started {dateShortIn(campaign.createdAt, tenant.timezone)}
                    {campaign.createdBy ? ` by ${campaign.createdBy.user.firstName}` : ""} · {campaign.counts.sent} of {campaign.counts.total} sent
                    {description.length > 0 && ` · customers ${description.join(", ")}`}
                </p>
            </div>
            <details className="rounded-sm border border-slate-200 bg-white px-4 py-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-slate-500">The message</summary>
                {campaign.subject && <p className="mt-2 text-sm font-medium text-slate-700">{campaign.subject}</p>}
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{campaign.body}</p>
            </details>
            <CampaignQueue tenant={slug} campaign={campaign} />
        </div>
    );
}
