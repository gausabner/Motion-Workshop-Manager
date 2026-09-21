import { redirect } from "next/navigation";

/** Invoices live with every other document in the transaction centre. Old links land there. */
export default async function InvoicesRedirect({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant } = await params;
    redirect(`/${tenant}/dashboard/transactions`);
}
