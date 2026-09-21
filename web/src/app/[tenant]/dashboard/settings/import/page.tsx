import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ImportWizard } from "@/components/settings/ImportWizard";

export const metadata = { title: "Import | MOTION Workshop Manager" };

export default async function ImportPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Bring your records across</h3>
                <p className="text-sm text-slate-500">
                    Export a CSV from whatever you use now and drop it here. MOTION recognises the column names the usual systems export — including Workshop Software&rsquo;s —
                    and shows you exactly what it understood before anything is saved.
                </p>
            </div>
            <div className="border-t border-slate-200" />
            <ImportWizard tenant={slug} />
        </div>
    );
}
