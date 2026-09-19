import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getTemplateDraft, templateProducts } from "@/lib/inspections/templates";
import { TemplateBuilder } from "@/components/inspections/TemplateBuilder";

export const metadata = { title: "Edit inspection template | MOTION Workshop Manager" };

export default async function TemplateEditPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();
    const [template, products] = await Promise.all([getTemplateDraft(db, id), templateProducts(db)]);
    if (!template) notFound();
    return (
        <div className="space-y-4">
            <div>
                <Link href={`/${slug}/dashboard/settings/inspections`} className="text-xs font-medium text-teal-700 hover:underline">← All templates</Link>
                <h3 className="mt-1 text-lg font-medium">{template.draft.name}</h3>
                <p className="text-sm text-slate-500">
                    {template.used > 0 ? `Used on ${template.used} inspection${template.used === 1 ? "" : "s"}; those keep the checks they started with. ` : ""}
                    Readings are what the mechanic measures, such as tread depth on four corners. The product and usual price are what an approved finding becomes on the job card; the mechanic can still change the price per job.
                    {!template.active && " This template is switched off, so it cannot start new inspections."}
                </p>
            </div>
            <div className="border-t border-slate-200" />
            <TemplateBuilder tenant={slug} id={template.id} initial={template.draft} products={products} currencySymbol={tenant.currency === "ZAR" ? "R" : "N$"} />
        </div>
    );
}
