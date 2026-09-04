import { MechanicForm } from "@/components/admin/MechanicForm";

export const metadata = {
    title: "New Mechanic | Admin | MOTION Workshop Manager",
};

export default function NewMechanicPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto">
            <MechanicForm />
        </div>
    );
}
