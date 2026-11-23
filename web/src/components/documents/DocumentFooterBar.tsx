"use client";

import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProcessDialog } from "@/components/documents/ProcessDialog";
import { editorFormId, useEditing } from "@/lib/documents/unsaved";
import type { DocumentRecord } from "@/lib/documents/queries";

/**
 * The finishing actions of a draft, where SAP keeps them: in a bar along the
 * bottom of the page, beside the line that says where the draft stands. Save
 * is the filled button while there is something to save; once saved, Process
 * is. One filled button at a time, so the next step is never in doubt.
 */
export function DocumentFooterBar({ tenant, doc, canProcess, showProcess }: { tenant: string; doc: DocumentRecord; canProcess: boolean; showProcess: boolean }) {
    const { unsaved, saving, said } = useEditing(doc.id);
    const status = saving
        ? "Saving…"
        : unsaved
          ? "Unsaved changes. Save before you process."
          : said?.ok
            ? said.text
            : "Draft. Nothing is posted until you process it.";
    return (
        <div className="above-tab-bar sticky z-20 -mx-4 border-t border-slate-200 bg-white px-4 py-2.5 shadow-[0_-10px_15px_-3px_rgb(15_23_42/0.05)] sm:-mx-6 sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-end gap-2">
                <p role="status" className={`mr-auto text-sm ${unsaved && !saving ? "font-medium text-slate-800" : "text-slate-600"}`}>
                    {status}
                </p>
                <Button
                    type="submit"
                    form={editorFormId(doc.id)}
                    size="sm"
                    variant={unsaved ? "default" : "outline"}
                    className={unsaved ? "bg-teal-700 hover:bg-teal-800" : ""}
                    disabled={saving}
                >
                    <Save className="mr-1 h-4 w-4" aria-hidden="true" />
                    {saving ? "Saving…" : "Save"}
                </Button>
                {showProcess && canProcess && <ProcessDialog tenant={tenant} doc={doc} disabled={unsaved || saving} />}
            </div>
        </div>
    );
}
