import { MechanicEditForm } from "@/components/admin/MechanicEditForm";

export const metadata = {
    title: "Edit Mechanic | Admin | MOTION Workshop Manager",
};

export default function EditMechanicPage({ params }: { params: { id: string } }) {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto w-full">
            <MechanicEditForm id={params.id} />
        </div>
    );
}
