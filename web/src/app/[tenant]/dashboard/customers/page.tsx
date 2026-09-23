import { CustomerList } from "@/components/customers/CustomerList";
import { requireTenant } from "@/lib/auth/session";
import { listCustomers } from "@/lib/customers/queries";
import { redactContactAll } from "@/lib/auth/redact";

export const metadata = { title: "Customers | MOTION Workshop Manager" };

type Search = { q?: string; archived?: string; page?: string; size?: string };

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<Search> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, membership } = await requireTenant(slug);
    const q = sp.q?.trim() ?? "";
    const archived = sp.archived === "1";
    const data = await listCustomers(db, { q, archived, page: Number(sp.page) || 1, size: Number(sp.size) || 25 });
    // Stripped here rather than hidden in the markup: a mechanic browsing the
    // customer list should not have every address and telephone number sitting
    // in the page source.
    const rows = redactContactAll(data.rows, membership);
    return <CustomerList tenant={slug} data={{ ...data, rows }} q={q} archived={archived} />;
}
