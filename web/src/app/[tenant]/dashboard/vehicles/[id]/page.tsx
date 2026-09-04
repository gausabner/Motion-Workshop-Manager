import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VehicleForm } from "@/components/vehicles/VehicleForm";
import { requireTenant } from "@/lib/auth/session";
import { getVehicle, listCustomerOptions } from "@/lib/vehicles/queries";
import { setVehicleArchived } from "@/lib/vehicles/actions";
import { dateShort } from "@/lib/format";

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ tenant: string; id: string }>; searchParams: Promise<{ saved?: string }> }) {
    const [{ tenant: slug, id }, { saved }] = await Promise.all([params, searchParams]);
    const { db } = await requireTenant(slug);
    const [vehicle, customers] = await Promise.all([getVehicle(db, id), listCustomerOptions(db)]);
    if (!vehicle) notFound();
    const archive = setVehicleArchived.bind(null, slug, vehicle.id, !vehicle.archivedAt);
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Car className="w-6 h-6 text-slate-400" />
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 leading-tight flex items-center gap-3">
                            <span className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 text-sm font-bold px-2 py-0.5 rounded">{vehicle.plate}</span>
                            {vehicle.year ? `${vehicle.year} ` : ""}{vehicle.make} {vehicle.model}
                        </h1>
                        <p className="text-xs text-slate-500">
                            {vehicle.archivedAt ? <span className="text-amber-700 font-medium">Archived {dateShort(vehicle.archivedAt)} · </span> : null}
                            {vehicle.customer ? <>Owner: <Link href={`/${slug}/dashboard/customers/${vehicle.customer.id}`} className="text-teal-700 hover:underline">{vehicle.customer.firstName} {vehicle.customer.lastName}</Link></> : "No owner on record"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {saved && <span className="text-sm text-teal-700">Saved</span>}
                    <form action={archive}>
                        <Button type="submit" variant="outline" size="sm" className={vehicle.archivedAt ? "text-teal-700" : "text-slate-600"}>
                            {vehicle.archivedAt ? <><ArchiveRestore className="w-4 h-4 mr-1" />Unarchive</> : <><Archive className="w-4 h-4 mr-1" />Archive</>}
                        </Button>
                    </form>
                </div>
            </div>
            <VehicleForm tenant={slug} vehicle={vehicle} customers={customers} />
        </div>
    );
}
