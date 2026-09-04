import { VehicleList } from "@/components/vehicles/VehicleList";
import { requireTenant } from "@/lib/auth/session";
import { listVehicles } from "@/lib/vehicles/queries";

export const metadata = { title: "Vehicles | MOTION Workshop Manager" };

type Search = { q?: string; archived?: string; page?: string; size?: string };

export default async function VehiclesPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<Search> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db } = await requireTenant(slug);
    const q = sp.q?.trim() ?? "";
    const archived = sp.archived === "1";
    const data = await listVehicles(db, { q, archived, page: Number(sp.page) || 1, size: Number(sp.size) || 25 });
    return <VehicleList tenant={slug} data={data} q={q} archived={archived} />;
}
