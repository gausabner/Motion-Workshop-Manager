import type { Metadata } from "next";
import { recordOpen } from "@/lib/sharing/links";
import { portalAccess, portalView } from "@/lib/portal/data";
import { openPortalInspection } from "@/lib/portal/actions";
import { onlineBookingSettings, parseSettings } from "@/lib/settings/schema";
import { PortalView } from "@/components/portal/PortalView";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false }, referrer: "no-referrer" };

const REASONS = {
    unknown: "This link is not valid. It may have been copied incompletely.",
    expired: "This link has expired. Ask the workshop to send you a new one.",
    revoked: "This link has been withdrawn by the workshop.",
    off: "The workshop is not using its customer portal at the moment. Contact them directly.",
} as const;

/**
 * A customer's own page at the workshop. The link is the credential and it
 * reaches this one customer; what is on it is the workshop's choice.
 */
export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const access = await portalAccess(token);
    if (!access.ok) {
        return (
            <main className="grid min-h-svh place-items-center bg-slate-100 p-6">
                <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-center">
                    <h1 className="text-lg font-bold text-slate-800">Link unavailable</h1>
                    <p className="mt-2 text-slate-600">{REASONS[access.reason]}</p>
                </div>
            </main>
        );
    }
    const { tenant, db, customer, settings, share } = access;
    await recordOpen(share.id);
    const data = await portalView(db, tenant, customer.id, settings);
    const base = `/portal/${token}`;
    return (
        <PortalView
            customerName={customer.firstName}
            workshop={{ name: tenant.name, phone: tenant.phone ?? tenant.mobile, whatsapp: tenant.whatsapp ?? tenant.mobile, currency: tenant.currency, accent: settings.accent, welcome: settings.welcome }}
            data={data}
            links={{
                document: (id) => `${base}/document/${id}`,
                statement: `${base}/statement`,
                inspection: (id) => openPortalInspection.bind(null, token, id),
                book: onlineBookingSettings(tenant.settings).enabled ? `/${tenant.slug}/book` : null,
                logo: parseSettings(tenant.settings).logoAttachmentId ? `${base}/logo` : null,
            }}
        />
    );
}
