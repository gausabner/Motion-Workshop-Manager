import { notFound } from "next/navigation";
import { TaxSettingsForm } from "@/components/settings/TaxSettingsForm";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";

export const metadata = { title: "Tax settings | MOTION Workshop Manager" };

export default async function TaxSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Tax &amp; terms</h3>
                <p className="text-sm text-slate-500">What gets stamped onto the next document you raise.</p>
            </div>
            <div className="border-t border-slate-200" />
            <TaxSettingsForm
                tenant={slug}
                tax={{
                    taxName: tenant.taxName,
                    salesTaxRate: tenant.salesTaxRate.toNumber(),
                    purchaseTaxRate: tenant.purchaseTaxRate.toNumber(),
                    pricesIncludeTax: tenant.pricesIncludeTax,
                    defaultPaymentTermsDays: tenant.defaultPaymentTermsDays,
                }}
            />
        </div>
    );
}
