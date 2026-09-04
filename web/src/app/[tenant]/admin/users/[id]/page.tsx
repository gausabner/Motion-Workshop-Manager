import { UserEditForm } from "@/components/admin/UserEditForm";

export const metadata = {
    title: "Edit User | Admin | MOTION Workshop Manager",
};

export default function EditUserPage({ params }: { params: { id: string } }) {
    // In a real application, we would fetch the user by ID.
    // Since we're building the UI mapping, we mock the email address.
    const mockEmail = params.id === "1" ? "gausabner@gmail.com" : "demo@gmail.com";

    return (
        <div className="flex flex-col h-full bg-slate-50 p-6 overflow-hidden overflow-y-auto">
            <UserEditForm email={mockEmail} />
        </div>
    );
}
