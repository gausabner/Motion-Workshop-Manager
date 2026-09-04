import { UserForm } from "@/components/admin/UserForm";

export const metadata = {
    title: "New User | Admin | MOTION Workshop Manager",
};

export default function NewUserPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto">
            <UserForm />
        </div>
    );
}
