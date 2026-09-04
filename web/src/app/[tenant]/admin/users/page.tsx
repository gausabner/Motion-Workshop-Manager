import { UserList } from "@/components/admin/UserList";

export const metadata = {
    title: "Users | Admin | MOTION Workshop Manager",
};

export default function UsersPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto">
            <UserList />
        </div>
    );
}
