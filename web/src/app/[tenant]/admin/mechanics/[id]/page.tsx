import { MechanicEditForm } from "@/components/admin/MechanicEditForm";

export const metadata = {
    title: "Edit Mechanic | Admin | MOTION Workshop Manager",
};

export default async function EditMechanicPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto w-full">
            <MechanicEditForm id={id} />
        </div>
    );
}
