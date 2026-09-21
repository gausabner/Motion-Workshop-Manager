import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { portalView } from "@/lib/portal/data";
import { onlineBookingSettings, parseSettings, portalSettings } from "@/lib/settings/schema";
import { PortalView } from "@/components/portal/PortalView";

export const metadata = { title: "Portal preview | MOTION Workshop Manager" };

/**
 * Exactly what this customer sees, rendered by the same code as the real
 * portal — only the links point at the staff screens, so nothing here counts
 * as the customer opening it.
 */
export default async function PortalPreviewPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant } = await requireTenant(slug);
    const customer = await db.customer.findUnique({ where: { id }, select: { id: true, firstName: true, lastName: true } });
    if (!customer) notFound();
    const settings = portalSettings(tenant.settings);
    const data = await portalView(db, tenant, customer.id, settings);
    const logoId = parseSettings(tenant.settings).logoAttachmentId;
    const staff = `/${slug}/dashboard`;
    return (
        <div className="-m-6">
            <PortalView
                customerName={customer.firstName}
                workshop={{ name: tenant.name, phone: tenant.phone ?? tenant.mobile, whatsapp: tenant.whatsapp ?? tenant.mobile, currency: tenant.currency, accent: settings.accent, welcome: settings.welcome }}
                data={data}
                links={{
                    document: (docId) => `${staff}/documents/${docId}/pdf`,
                    statement: `${staff}/customers/${customer.id}/statement/pdf`,
                    inspection: (inspectionId) => `${staff}/inspections/${inspectionId}`,
                    book: onlineBookingSettings(tenant.settings).enabled ? `/${slug}/book` : null,
                    logo: logoId ? `/${slug}/attachments/${logoId}` : null,
                }}
                banner={
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-800 px-4 py-2 text-sm text-white">
                        <span>
                            Preview: what {customer.firstName} {customer.lastName} sees.{!settings.enabled && " The portal is off, so they cannot open it yet."}
                        </span>
                        <Link href={`${staff}/customers/${customer.id}`} className="font-medium underline">Back to customer</Link>
                    </div>
                }
            />
        </div>
    );
}
