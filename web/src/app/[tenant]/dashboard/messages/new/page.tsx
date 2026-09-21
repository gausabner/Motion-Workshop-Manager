import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { portalSettings } from "@/lib/settings/schema";
import { CampaignComposer } from "@/components/campaigns/CampaignComposer";

export const metadata = { title: "New campaign | MOTION Workshop Manager" };

export default async function NewCampaignPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "messages:send")) notFound();
    const sources = await db.customerSource.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
    return (
        <div className="max-w-5xl space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/messages`} className="text-xs font-medium text-teal-700 hover:underline">← Messages</Link>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">New campaign</h1>
                <p className="text-sm text-slate-500">Customers who have opted out are never included.</p>
            </div>
            <CampaignComposer tenant={slug} sources={sources} currency={tenant.currency} portalOn={portalSettings(tenant.settings).enabled} />
        </div>
    );
}
