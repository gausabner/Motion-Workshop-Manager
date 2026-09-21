import { notFound } from "next/navigation";
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { parseSettings } from "@/lib/settings/schema";

export const metadata = { title: "Company profile | MOTION Workshop Manager" };

export default async function CompanySettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();
    const settings = parseSettings(tenant.settings);

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Company profile</h3>
                <p className="text-sm text-slate-500">How the workshop appears on everything a customer receives.</p>
            </div>
            <div className="border-t border-slate-200" />
            <CompanySettingsForm
                tenant={slug}
                profile={{
                    name: tenant.name,
                    registrationNumber: tenant.registrationNumber,
                    vatNumber: tenant.vatNumber,
                    address1: tenant.address1,
                    address2: tenant.address2,
                    suburb: tenant.suburb,
                    city: tenant.city,
                    region: tenant.region,
                    postcode: tenant.postcode,
                    country: tenant.country,
                    phone: tenant.phone,
                    mobile: tenant.mobile,
                    whatsapp: tenant.whatsapp,
                    email: tenant.email,
                    web: tenant.web,
                    timezone: tenant.timezone,
                    currency: tenant.currency,
                    bankDetails: settings.bankDetails ?? "",
                    logoAttachmentId: settings.logoAttachmentId,
                }}
            />
        </div>
    );
}
