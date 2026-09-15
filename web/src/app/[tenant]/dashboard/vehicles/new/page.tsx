import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { requireTenant } from "@/lib/auth/session";
import { customerHit } from "@/lib/search/hits";

export const metadata = { title: "New vehicle | MOTION Workshop Manager" };

export default async function NewVehiclePage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ customerId?: string }> }) {
    const [{ tenant: slug }, { customerId }] = await Promise.all([params, searchParams]);
    const { db } = await requireTenant(slug);
    // Arriving from a customer's page: preselect them as the owner.
    const owner = customerId
        ? await db.customer.findUnique({ where: { id: customerId }, select: { id: true, firstName: true, lastName: true, mobile: true, email: true } })
        : null;
    return <VehicleForm tenant={slug} initialOwner={owner ? customerHit(owner) : null} />;
}
