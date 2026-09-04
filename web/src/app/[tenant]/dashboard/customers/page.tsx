import { CustomerList } from "@/components/customers/CustomerList";
import { requireTenant } from "@/lib/auth/session";
import { listCustomers } from "@/lib/customers/queries";

export const metadata = { title: "Customers | MOTION Workshop Manager" };

type Search = { q?: string; archived?: string; page?: string; size?: string };

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<Search> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db } = await requireTenant(slug);
    const q = sp.q?.trim() ?? "";
    const archived = sp.archived === "1";
    const data = await listCustomers(db, { q, archived, page: Number(sp.page) || 1, size: Number(sp.size) || 25 });
    return <CustomerList tenant={slug} data={data} q={q} archived={archived} />;
}
