import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";

export default function CompanySettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Company Profile</h3>
                <p className="text-sm text-slate-500">
                    This is how others will see your workshop on invoices and emails.
                </p>
            </div>
            <div className="border-t border-slate-200 my-4" />
            <CompanySettingsForm />
        </div>
    );
}
