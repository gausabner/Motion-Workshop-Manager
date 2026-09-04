import { TaxSettingsForm } from "@/components/settings/TaxSettingsForm";

export default function TaxSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Tax & Financials</h3>
                <p className="text-sm text-slate-500">
                    Determine how Motion calculates ledger balances, applies sales tax, and handles complex multi-country or layered tax regulations.
                </p>
            </div>
            <div className="border-t border-slate-200 my-4" />
            <TaxSettingsForm />
        </div>
    );
}
