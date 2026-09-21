import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ensureDefaultInspectionTemplate } from "@/lib/inspections/defaults";
import { listTemplates } from "@/lib/inspections/templates";
import { newTemplateAction } from "@/lib/inspections/template-actions";
import { TemplateRowActions } from "@/components/inspections/TemplateRowActions";

export const metadata = { title: "Inspection templates | MOTION Workshop Manager" };

export default async function InspectionTemplatesPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();
    await ensureDefaultInspectionTemplate(db, tenant.id);
    const templates = await listTemplates(db);
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 className="text-lg font-medium">Inspection templates</h3>
                    <p className="text-sm text-slate-500">The checklists your mechanics work through. Changing a template never changes an inspection already done.</p>
                </div>
                <form action={newTemplateAction.bind(null, slug)}>
                    <Button type="submit" size="sm" className="bg-teal-600 hover:bg-teal-700"><Plus className="w-4 h-4 mr-1" />New template</Button>
                </form>
            </div>
            <div className="border-t border-slate-200" />
            <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200 bg-white">
                {templates.map((t) => (
                    <li key={t.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${t.active ? "" : "bg-slate-50"}`}>
                        <div className="min-w-0 flex-1">
                            <Link href={`/${slug}/dashboard/settings/inspections/${t.id}`} className={`font-medium hover:underline ${t.active ? "text-slate-800" : "text-slate-400"}`}>{t.name}</Link>
                            <p className="text-xs text-slate-500">
                                {t.checks} check{t.checks === 1 ? "" : "s"} · {t.used === 0 ? "not used yet" : `used on ${t.used} inspection${t.used === 1 ? "" : "s"}`}{!t.active && " · switched off"}
                            </p>
                        </div>
                        <TemplateRowActions tenant={slug} id={t.id} active={t.active} used={t.used} />
                    </li>
                ))}
            </ul>
            <p className="text-xs text-slate-400">When more than one template is switched on, whoever starts an inspection picks which one.</p>
        </div>
    );
}
