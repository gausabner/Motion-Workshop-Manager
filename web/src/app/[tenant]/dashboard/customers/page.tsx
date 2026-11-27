import { CustomerList } from "@/components/customers/CustomerList";
import { CustomerSheet } from "@/components/customers/CustomerSheet";
import { requireTenant } from "@/lib/auth/session";
import { getCustomer, listCustomers } from "@/lib/customers/queries";
import { getCustomerAccount } from "@/lib/payments/queries";
import { redactContact, redactContactAll } from "@/lib/auth/redact";
import { businessToday } from "@/lib/tenant/today";

export const metadata = { title: "Customers | MOTION Workshop Manager" };

type Search = { q?: string; archived?: string; page?: string; size?: string; customer?: string };

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<Search> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    const q = sp.q?.trim() ?? "";
    const archived = sp.archived === "1";
    /*
     * A customer opened from the list shows over it, as `?customer=<id>`, so
     * the list stays mounted with its scroll position and Back closes the
     * summary. It is a parameter rather than an intercepted route on purpose:
     * an intercepted `customers/[id]` also caught `customers/new`.
     */
    const [data, open, account] = await Promise.all([
        listCustomers(db, { q, archived, page: Number(sp.page) || 1, size: Number(sp.size) || 25 }),
        sp.customer ? getCustomer(db, sp.customer) : Promise.resolve(null),
        sp.customer ? getCustomerAccount(db, sp.customer, businessToday(tenant.timezone)) : Promise.resolve(null),
    ]);
    // Stripped here rather than hidden in the markup: a mechanic browsing the
    // customer list should not have every address and telephone number sitting
    // in the page source.
    const rows = redactContactAll(data.rows, membership);
    return (
        <>
            <CustomerList tenant={slug} data={{ ...data, rows }} q={q} archived={archived} />
            {open && <CustomerSheet key={open.id} tenant={slug} customer={redactContact(open, membership)} account={account} currency={tenant.currency} />}
        </>
    );
}
