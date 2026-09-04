import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { requireTenant } from "@/lib/auth/session";
import { listCustomerOptions } from "@/lib/vehicles/queries";

export const metadata = { title: "New vehicle | MOTION Workshop Manager" };

export default async function NewVehiclePage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ customerId?: string }> }) {
    const [{ tenant: slug }, { customerId }] = await Promise.all([params, searchParams]);
    const { db } = await requireTenant(slug);
    const customers = await listCustomerOptions(db);
    return <VehicleForm tenant={slug} customers={customers} defaultCustomerId={customerId} />;
}
