import { CustomerForm } from "@/components/customers/CustomerForm";
import { requireTenant } from "@/lib/auth/session";
import { listCustomerSources } from "@/lib/customers/queries";

export const metadata = { title: "New customer | MOTION Workshop Manager" };

export default async function NewCustomerPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db } = await requireTenant(slug);
    const sources = await listCustomerSources(db);
    return <CustomerForm tenant={slug} sources={sources} />;
}
