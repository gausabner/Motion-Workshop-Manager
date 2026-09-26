"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ENTITY_LIST, type ImportEntity } from "@/lib/import/entities";
import { analyseFileAction, importFileAction, type Preview } from "@/lib/import/actions";
import type { ImportResult } from "@/lib/import/service";

const field = "h-8 rounded-md border border-slate-300 bg-white px-2 text-sm";

/**
 * Bringing a workshop's records across. Nothing is written until the file has
 * been read back to them — which columns were understood, which were ignored,
 * and exactly which rows cannot be used and why.
 */
export function ImportWizard({ tenant }: { tenant: string }) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [entity, setEntity] = useState<ImportEntity>("customers");
    const [text, setText] = useState("");
    const [fileName, setFileName] = useState<string>();
    const [preview, setPreview] = useState<Preview | null>(null);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState<string>();
    const [busy, start] = useTransition();
    const spec = ENTITY_LIST.find((e) => e.key === entity)!;

    function look(content: string, mapping?: Record<string, string>) {
        setError(undefined);
        setResult(null);
        start(async () => {
            const response = await analyseFileAction(tenant, entity, content, mapping);
            if (!response.ok) {
                setError(response.message);
                setPreview(null);
                return;
            }
            setPreview(response.preview);
        });
    }

    async function onFile(file: File) {
        const content = await file.text();
        setText(content);
        setFileName(file.name);
        look(content);
    }

    const mappedFields = spec.fields.filter((f) => preview?.mapping[f.key]);

    return (
        <div className="space-y-4">
            <section className="rounded-sm border border-slate-200 bg-white">
                <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What is in the file</h2>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <label className="space-y-1 text-sm">
                        <span className="block text-slate-600">It holds</span>
                        <select value={entity} onChange={(e) => { setEntity(e.target.value as ImportEntity); setPreview(null); setResult(null); }} className={`${field} h-9 min-w-56`}>
                            {ENTITY_LIST.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                        </select>
                    </label>
                    <p className="flex-1 text-xs text-slate-500">{spec.blurb}</p>
                    <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void onFile(file); }} />
                    <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><Upload className="mr-1 h-4 w-4" />Choose a CSV file</Button>
                </div>
                <div className="border-t border-slate-100 px-4 py-3">
                    <label className="block space-y-1 text-sm">
                        <span className="text-slate-600">Or paste it here {fileName && <span className="text-slate-400">· {fileName}</span>}</span>
                        <textarea
                            value={text} onChange={(e) => setText(e.target.value)} rows={4} spellCheck={false}
                            placeholder="First Name,Last Name,Mobile,Email&#10;Anna,Shilongo,081 234 5678,anna@example.com"
                            className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                        />
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                        <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={busy || !text.trim()} onClick={() => look(text)}>
                            {busy ? "Reading…" : "Read the file"}
                        </Button>
                        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
                    </div>
                </div>
            </section>

            {preview && (
                <>
                    <section className="rounded-sm border border-slate-200 bg-white">
                        <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Which column is which</h2>
                        <ul className="grid gap-2 px-4 py-3 sm:grid-cols-2">
                            {spec.fields.map((f) => (
                                <li key={f.key} className="flex items-center gap-2 text-sm">
                                    <span className="w-40 shrink-0 text-slate-600">{f.label}{f.required && <span className="text-red-600">*</span>}</span>
                                    <select
                                        value={preview.mapping[f.key] ?? ""}
                                        onChange={(e) => look(text, { ...preview.mapping, [f.key]: e.target.value })}
                                        className={`${field} min-w-0 flex-1`}
                                    >
                                        <option value="">— not in this file —</option>
                                        {preview.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </li>
                            ))}
                        </ul>
                        {preview.ignoredColumns.length > 0 && (
                            <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                                Not being brought in: {preview.ignoredColumns.join(", ")}.
                            </p>
                        )}
                    </section>

                    <section className="rounded-sm border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
                            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                {preview.readyCount} of {preview.total} row{preview.total === 1 ? "" : "s"} ready · matched on {spec.matchOn}
                            </h2>
                            <Button
                                type="button" size="sm" className="h-7 bg-teal-600 hover:bg-teal-700"
                                disabled={busy || preview.readyCount === 0 || preview.missingRequired.length > 0}
                                onClick={() => start(async () => {
                                    const response = await importFileAction(tenant, entity, text, preview.mapping);
                                    if (!response.ok) setError(response.message);
                                    else { setResult(response.result); setPreview(null); }
                                })}
                            >
                                {busy ? "Importing…" : `Import ${preview.readyCount} row${preview.readyCount === 1 ? "" : "s"}`}
                            </Button>
                        </div>
                        {preview.missingRequired.length > 0 && (
                            <p className="flex items-start gap-2 border-b border-slate-100 px-4 py-2 text-sm text-red-700">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />The file still needs a column for: {preview.missingRequired.join(", ")}.
                            </p>
                        )}
                        {mappedFields.length > 0 && preview.sample.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs tabular-nums">
                                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                                        <tr><th className="px-3 py-1.5 text-left">Line</th>{mappedFields.map((f) => <th key={f.key} className="px-3 py-1.5 text-left font-semibold">{f.label}</th>)}</tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {preview.sample.map((row) => (
                                            <tr key={row.line}>
                                                <td className="px-3 py-1 text-slate-400">{row.line}</td>
                                                {row.cells.map((cell, i) => <td key={i} className="px-3 py-1 text-slate-700">{cell}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {(preview.problems.length > 0 || preview.duplicates.length > 0) && (
                            <ul className="max-h-60 space-y-0.5 overflow-auto border-t border-slate-100 px-4 py-2 text-xs">
                                {preview.problems.map((p) => <li key={`p${p.line}`} className="text-amber-700">Line {p.line}: {p.message}</li>)}
                                {preview.duplicates.map((d) => <li key={`d${d.line}`} className="text-slate-500">Line {d.line}: {d.message}</li>)}
                            </ul>
                        )}
                        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
                            Rows that cannot be used are skipped, not guessed at. Bring them in later by fixing the file and importing it again — anything already here is updated, never duplicated.
                        </p>
                    </section>
                </>
            )}

            {result && (
                <section className="rounded-sm border border-teal-300 bg-teal-50 px-4 py-3">
                    <p className="flex items-center gap-2 font-medium text-teal-900">
                        <CheckCircle2 className="h-5 w-5" />{result.created} added, {result.updated} updated{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
                    </p>
                    {result.problems.length > 0 && (
                        <ul className="mt-2 max-h-40 space-y-0.5 overflow-auto text-xs text-teal-900">
                            {result.problems.map((p) => <li key={p.line}>Line {p.line}: {p.message}</li>)}
                        </ul>
                    )}
                </section>
            )}
        </div>
    );
}
