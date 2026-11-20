"use client";

import { Button } from "@/components/ui/button";
import { saveCheckBayTemplates } from "@/lib/fleet/actions";
import { Outcome, Panel, field, useAction } from "@/components/settings/council/shared";

/**
 * The inspection templates the check bay works through. With one chosen, the
 * assessment or quality check is an inspection: started from the job card,
 * filled in item by item, and signed with what it found. Without, the check
 * bay signs with a note.
 */
export function CheckBayTemplates({ tenant, templates, assessmentTemplateId, qualityTemplateId }: { tenant: string; templates: { id: string; name: string }[]; assessmentTemplateId: string | null; qualityTemplateId: string | null }) {
    const [state, action, saving] = useAction(saveCheckBayTemplates.bind(null, tenant));
    const select = (name: string, label: string, value: string | null) => (
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            {label}
            <select name={name} defaultValue={value ?? ""} className={`${field} w-72 max-w-full font-normal`}>
                <option value="">None: the check bay signs with a note</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
        </label>
    );
    return (
        <Panel title="The check bay's inspections" footer="Templates are made under Settings › Inspection templates. A failed item on the quality check sends the vehicle back to the workshop that did the work.">
            <form action={action} className="space-y-3 px-4 py-3">
                <div className="flex flex-wrap gap-4">
                    {select("assessmentTemplateId", "Assessment, when it arrives", assessmentTemplateId)}
                    {select("qualityTemplateId", "Quality check, before it is released", qualityTemplateId)}
                </div>
                {templates.length === 0 && <p className="text-xs text-slate-600">There are no inspection templates yet, so the check bay signs with a note.</p>}
                <div className="flex items-center gap-3">
                    <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                    <Outcome state={state} />
                </div>
            </form>
        </Panel>
    );
}
