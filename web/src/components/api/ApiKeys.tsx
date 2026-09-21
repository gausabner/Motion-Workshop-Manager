"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createApiKey, revokeApiKey, type NewKeyState } from "@/lib/api/key-actions";
import type { KeyRow } from "@/lib/api/key-service";

const field = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";

/**
 * Making a key shows it once. Everything after that shows only its head, so
 * the screen can never become a place to go and read a key back.
 */
export function ApiKeys({ tenant, keys, timezone }: { tenant: string; keys: KeyRow[]; timezone: string }) {
    const router = useRouter();
    const [adding, setAdding] = useState(false);
    const [copied, setCopied] = useState(false);
    const [busy, start] = useTransition();
    const [state, submit, pending] = useActionState<NewKeyState, FormData>(
        async (prev, formData) => {
            const result = await createApiKey(tenant, prev, formData);
            if (result.ok) { setAdding(false); setCopied(false); router.refresh(); }
            return result;
        },
        { ok: false },
    );

    const when = (d: Date | string | null) =>
        d ? new Date(d).toLocaleString("en-GB", { timeZone: timezone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : null;

    const revoke = (row: KeyRow) => {
        if (!window.confirm(`Revoke “${row.name}”? Anything using it stops working straight away.`)) return;
        start(async () => { await revokeApiKey(tenant, row.id); router.refresh(); });
    };

    return (
        <div className="space-y-4">
            {state.ok && state.token && (
                <div className="rounded-sm border border-teal-300 bg-teal-50 px-4 py-3">
                    <p className="text-sm font-medium text-teal-900">“{state.name}” is ready. Copy it now — this is the only time it is shown.</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 break-all rounded-sm border border-teal-200 bg-white px-2 py-1 font-mono text-xs text-slate-800">{state.token}</code>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => { navigator.clipboard.writeText(state.token!).then(() => setCopied(true), () => setCopied(false)); }}
                        >
                            {copied ? <><Check className="mr-1 h-4 w-4" />Copied</> : <><Copy className="mr-1 h-4 w-4" />Copy</>}
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-teal-800">We keep only a fingerprint of it. If it is lost, revoke it here and make another.</p>
                </div>
            )}

            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{keys.filter((k) => !k.revokedAt).length} live · {keys.filter((k) => k.revokedAt).length} revoked</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding((a) => !a)}><Plus className="mr-1 h-4 w-4" />New key</Button>
            </div>

            {adding && (
                <form action={submit} className="flex flex-wrap items-end gap-3 rounded-sm border border-slate-200 bg-white px-4 py-3">
                    <label className="space-y-1 text-xs text-slate-500">
                        <span className="block">What is it for</span>
                        <input name="name" required maxLength={60} placeholder="Our website" className={`${field} w-56`} />
                    </label>
                    <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
                        <input type="checkbox" name="write" className="h-4 w-4 rounded border-slate-300" />
                        Let it create records too
                    </label>
                    <Button type="submit" size="sm" disabled={pending}>{pending ? "Making…" : "Make the key"}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
                    {!state.ok && state.message && <p className="w-full text-sm text-red-700">{state.message}</p>}
                </form>
            )}

            {keys.length === 0 ? (
                <p className="rounded-sm border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    No keys yet. Make one when something outside MOTION needs to read your workshop&rsquo;s data.
                </p>
            ) : (
                <ul className="divide-y divide-slate-100 rounded-sm border border-slate-200 bg-white">
                    {keys.map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                            <KeyRound className={`h-4 w-4 shrink-0 ${row.revokedAt ? "text-slate-300" : "text-slate-400"}`} />
                            <span className="min-w-0">
                                <span className={`block text-sm font-medium ${row.revokedAt ? "text-slate-400 line-through" : "text-slate-800"}`}>{row.name}</span>
                                <span className="block font-mono text-xs text-slate-400">{row.prefix}…</span>
                            </span>
                            <span className="text-xs text-slate-500">{row.scopes.includes("WRITE") ? "Reads and writes" : "Reads only"}</span>
                            <span className="min-w-0 flex-1 text-xs text-slate-400">
                                {row.revokedAt
                                    ? `Revoked ${when(row.revokedAt)}`
                                    : row.lastUsedAt
                                        ? `Last used ${when(row.lastUsedAt)}`
                                        : "Never used"}
                            </span>
                            {!row.revokedAt && (
                                <Button type="button" size="sm" variant="ghost" className="text-red-700 hover:text-red-800" disabled={busy} onClick={() => revoke(row)}>
                                    Revoke
                                </Button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
