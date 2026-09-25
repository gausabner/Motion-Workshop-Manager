import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { getCustomer } from "@/lib/customers/queries";
import { getCustomerAccount } from "@/lib/payments/queries";
import { redactContact } from "@/lib/auth/redact";
import { businessToday } from "@/lib/tenant/today";
import { CustomerSheet } from "@/components/customers/CustomerSheet";

/**
 * A customer opened from the list, over the list.
 *
 * Intercepted, so tapping a name does not navigate away: the list stays
 * mounted underneath with its scroll position intact. That is the whole point.
 * Coming back from a full page navigation put somebody who had scrolled 600px
 * into a customer list back at the top, because the scrolling element here is
 * `<main>` rather than the window and browser scroll restoration never applies
 * to it.
 *
 * A direct link or a refresh still renders the full page — this file is only
 * reached from inside the app, which is exactly the case worth improving.
 */
export default async function CustomerSheetPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);

    const [customer, account] = await Promise.all([
        getCustomer(db, id),
        getCustomerAccount(db, id, businessToday(tenant.timezone)),
    ]);
    if (!customer) notFound();

    return (
        <CustomerSheet
            tenant={slug}
            customer={redactContact(customer, membership)}
            account={account}
            currency={tenant.currency}
        />
    );
}
