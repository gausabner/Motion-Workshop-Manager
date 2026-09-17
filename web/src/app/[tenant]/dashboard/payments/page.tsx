import { PaymentList, PAYMENT_TABS, type PaymentTabKey } from "@/components/payments/PaymentList";
import { requireTenant } from "@/lib/auth/session";
import { listPayments, takenOn, type PaymentListParams } from "@/lib/payments/queries";
import { businessToday } from "@/lib/tenant/today";

export const metadata = { title: "Receipts | MOTION Workshop Manager" };

const TAB_FILTERS: Record<PaymentTabKey, Partial<PaymentListParams>> = {
    all: {},
    drafts: { state: "DRAFT" },
    posted: { state: "PROCESSED" },
    unapplied: { state: "PROCESSED", unappliedOnly: true },
    void: { state: "VOID" },
};

export default async function PaymentsPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant } = await requireTenant(slug);
    const tabKeys = PAYMENT_TABS.map((t) => t.key) as string[];
    const tab = (sp.tab && tabKeys.includes(sp.tab) ? sp.tab : "all") as PaymentTabKey;
    const q = sp.q?.trim() ?? "";
    const [data, takenToday] = await Promise.all([
        listPayments(db, { ...TAB_FILTERS[tab], q, page: Number(sp.page) || 1 }),
        takenOn(db, businessToday(tenant.timezone)),
    ]);
    return <PaymentList tenant={slug} data={data} tab={tab} q={q} takenToday={takenToday} />;
}
