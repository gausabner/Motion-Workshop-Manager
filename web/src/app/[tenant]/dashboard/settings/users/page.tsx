import { UserManagementTable } from "@/components/settings/UserManagementTable";

export default function UsersSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">User Management</h3>
                <p className="text-sm text-slate-500">
                    Invite staff, assign Service Advisor or Mechanic roles, and control access to the Mobile PWA.
                </p>
            </div>
            <div className="border-t border-slate-200 my-4" />
            <UserManagementTable />
        </div>
    );
}
