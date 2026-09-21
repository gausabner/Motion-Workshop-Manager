"use client";

import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { resetTemplate, saveTemplate } from "@/lib/messaging/actions";
import { MERGE_FIELDS, renderTemplate, unknownFields, type MergeValues } from "@/lib/templates/merge";

type Props = {
    tenant: string;
    kind: string;
    label: string;
    description: string;
    body: string;
    defaultBody: string;
    custom: boolean;
    sample: MergeValues;
    showLinkHint: boolean;
};

/**
 * One template, with the thing a workshop actually needs while writing it: a
 * preview of what the customer will read, rendered by the same code that
 * renders the real message.
 */
export function TemplateEditor({ tenant, kind, label, description, body: initial, defaultBody, custom, sample, showLinkHint }: Props) {
    const [state, formAction, saving] = useActionState(saveTemplate.bind(null, tenant, kind), initialActionState);
    const [body, setBody] = useState(initial);
    const [resetting, startReset] = useTransition();
    const area = useRef<HTMLTextAreaElement>(null);

    const preview = useMemo(() => renderTemplate(body, sample), [body, sample]);
    const typos = useMemo(() => unknownFields(body), [body]);
    const missingLink = showLinkHint && !/\{\{\s*link\s*\}\}/i.test(body);

    /** Put a field where the cursor is, not on the end. */
    function insert(key: string) {
        const el = area.current;
        const token = `{{${key}}}`;
        if (!el) return setBody((b) => b + token);
        const start = el.selectionStart ?? body.length;
        const end = el.selectionEnd ?? body.length;
        const next = body.slice(0, start) + token + body.slice(end);
        setBody(next);
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(start + token.length, start + token.length);
        });
    }

    return (
        <form action={formAction} className="border border-slate-200 rounded-sm bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b bg-slate-50">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
                    <p className="text-[11px] text-slate-500">{description}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${custom ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-300 bg-white text-slate-500"}`}>
                        {custom ? "Your wording" : "Standard wording"}
                    </span>
                    {state.message && <span className={`text-xs ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</span>}
                    {custom && (
                        <Button
                            type="button" size="sm" variant="ghost" className="h-7 text-slate-500" disabled={resetting}
                            onClick={() => startReset(async () => { await resetTemplate(tenant, kind); setBody(defaultBody); })}
                            title="Go back to the standard wording"
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />Reset
                        </Button>
                    )}
                    <Button type="submit" size="sm" className="h-7 bg-teal-600 hover:bg-teal-700" disabled={saving || body === initial}>
                        <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Saving…" : "Save"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                <div className="space-y-2">
                    <textarea
                        ref={area} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={7}
                        className="w-full rounded-md border border-input bg-white px-2 py-1.5 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                    />
                    {state.errors?.body && <p className="text-xs text-red-600">{state.errors.body[0]}</p>}
                    {typos.length > 0 && (
                        <p className="flex items-start gap-1.5 text-xs text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            Not a field we know: {typos.map((t) => `{{${t}}}`).join(", ")}. It will print as nothing — check the spelling.
                        </p>
                    )}
                    {missingLink && <p className="text-xs text-slate-500">No <code>{"{{link}}"}</code> — the link to the document will be added on the end.</p>}
                    <details>
                        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Insert a field</summary>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {MERGE_FIELDS.map((f) => (
                                <button
                                    key={f.key} type="button" onClick={() => insert(f.key)} title={`{{${f.key}}}`}
                                    className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600 hover:border-teal-400 hover:text-teal-700"
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </details>
                </div>
                <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">What the customer reads</p>
                    <div className="rounded-md border border-slate-200 bg-[#e7f7ee] p-3">
                        <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{preview || <span className="italic text-slate-400">Nothing — this prints blank.</span>}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">Sample customer and vehicle; your own workshop details.</p>
                </div>
            </div>
        </form>
    );
}
