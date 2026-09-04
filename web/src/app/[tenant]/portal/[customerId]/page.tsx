import { CustomerPortalView } from "@/components/portal/CustomerPortalView";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Service Portal | MOTION",
    description: "View your vehicle service history, approve inspections, and manage invoices securely.",
};

export default async function CustomerPortalPage({
    params,
}: {
    params: Promise<{ tenant: string; customerId: string }>;
}) {
    const resolvedParams = await params;

    return <CustomerPortalView tenant={resolvedParams.tenant} customerId={resolvedParams.customerId} />;
}
