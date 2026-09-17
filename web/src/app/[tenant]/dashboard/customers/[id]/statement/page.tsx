import { notFound } from "next/navigation";
import { StatementView } from "@/components/payments/StatementView";
import { requireTenant } from "@/lib/auth/session";
import { getStatement } from "@/lib/payments/queries";
import { businessToday } from "@/lib/tenant/today";

export const metadata = { title: "Statement | MOTION Workshop Manager" };

const DAY = 86_400_000;
const parseDate = (value: string | undefined, fallback: Date) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : fallback;

export default async function StatementPage({ params, searchParams }: { params: Promise<{ tenant: string; id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
    const [{ tenant: slug, id }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant } = await requireTenant(slug);
    const today = businessToday(tenant.timezone);
    const to = parseDate(sp.to, today);
    // Three months back is the window a workshop chases on, and it fits one page.
    const from = parseDate(sp.from, new Date(to.getTime() - 90 * DAY));

    const statement = await getStatement(db, id, from, to);
    if (!statement) notFound();
    return <StatementView tenant={slug} statement={statement} workshopName={tenant.name} />;
}
