import { requireFeature } from "@/lib/auth/session";

/** Part of a plan feature — see `lib/plans/features.ts`. A workshop whose plan lacks it is sent to Billing, which says which plan includes it. */
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
    const { tenant } = await params;
    await requireFeature(tenant, "inspections");
    return children;
}
