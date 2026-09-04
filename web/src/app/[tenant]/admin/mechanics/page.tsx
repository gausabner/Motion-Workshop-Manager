import { MechanicList } from "@/components/admin/MechanicList";

export const metadata = {
    title: "Mechanics | Admin | MOTION Workshop Manager",
};

export default function MechanicsPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden">
            <MechanicList />
        </div>
    );
}
