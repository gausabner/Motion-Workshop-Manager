import type { DocumentType } from "@prisma/client";
import { TransactionCentre, type TabKey } from "@/components/documents/TransactionCentre";
import { requireTenant } from "@/lib/auth/session";
import { listDocuments, type DocumentListParams } from "@/lib/documents/queries";

export const metadata = { title: "Transaction Centre | MOTION Workshop Manager" };

const TAB_FILTERS: Record<TabKey, Partial<DocumentListParams>> = {
    all: {},
    bookings: { types: ["BOOKING"] },
    jobs: { types: ["JOB_CARD"] },
    quotes: { types: ["QUOTE"] },
    invoices: { types: ["INVOICE", "CASH_SALE"] },
    unpaid: { unpaidOnly: true },
    credits: { types: ["CREDIT"] },
};

export default async function TransactionsPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ tab?: string; q?: string; page?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db } = await requireTenant(slug);
    const tab = (sp.tab && sp.tab in TAB_FILTERS ? sp.tab : "all") as TabKey;
    const q = sp.q?.trim() ?? "";
    const filter = TAB_FILTERS[tab];
    const data = await listDocuments(db, { ...filter, types: filter.types as DocumentType[] | undefined, q, page: Number(sp.page) || 1 });
    return <TransactionCentre tenant={slug} data={data} tab={tab} q={q} />;
}
