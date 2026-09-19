"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMPTY_FILTERS, type AudienceFilters } from "@/lib/campaigns/audience";
import { createCampaignAction, previewAudienceAction, type AudiencePreview } from "@/lib/campaigns/actions";
import { money } from "@/lib/format";

const field = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";
const MERGE = ["customer_first_name", "customer_name", "vehicle", "plate", "workshop_name", "workshop_phone", "link"];

/**
 * Pick who it goes to, then what it says. The count updates as the audience
 * changes, because "how many is this about to go to" is the one number worth
 * knowing before writing anything.
 */
export function CampaignComposer({ tenant, sources, currency, portalOn }: { tenant: string; sources: { id: string; name: string }[]; currency: string; portalOn: boolean }) {
    const [filters, setFilters] = useState<AudienceFilters>(EMPTY_FILTERS);
    const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL">("WHATSAPP");
    const [usePreferred, setUsePreferred] = useState(false);
    const [name, setName] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("Hi {{customer_first_name}}, ");
    const [preview, setPreview] = useState<AudiencePreview | null>(null);
    const [error, setError] = useState<string>();
    const [loading, startPreview] = useTransition();
    const [creating, startCreate] = useTransition();
    const set = (patch: Partial<AudienceFilters>) => setFilters((f) => ({ ...f, ...patch }));

    useEffect(() => {
        const timer = setTimeout(() => {
            startPreview(async () => setPreview(await previewAudienceAction(tenant, filters, channel, usePreferred)));
        }, 350);
        return () => clearTimeout(timer);
    }, [tenant, filters, channel, usePreferred]);

    function create() {
        setError(undefined);
        startCreate(async () => {
            const result = await createCampaignAction(tenant, { name: name.trim(), channel, usePreferred, subject: subject.trim(), body }, filters);
            if (result && !result.ok) setError(result.message);
        });
    }

    const wantsLink = /\{\{\s*link\s*\}\}/i.test(body);
    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
                <section className="rounded-sm border border-slate-200 bg-white">
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Who it goes to</h2>
                    <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">Money owing</span>
                            <select value={filters.owing} onChange={(e) => set({ owing: e.target.value as AudienceFilters["owing"] })} className={`${field} w-full`}>
                                <option value="any">Anyone</option>
                                <option value="owing">Owes us something</option>
                                <option value="overdue">More than 30 days overdue</option>
                            </select>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">How they found you</span>
                            <select
                                multiple={false}
                                value={filters.sourceIds[0] ?? ""}
                                onChange={(e) => set({ sourceIds: e.target.value ? [e.target.value] : [] })}
                                className={`${field} w-full`}
                            >
                                <option value="">Any source</option>
                                {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">Service due within</span>
                            <span className="flex items-center gap-2">
                                <input type="number" min={0} max={365} value={filters.serviceDueWithinDays} onChange={(e) => set({ serviceDueWithinDays: Number(e.target.value) })} className={`${field} w-20 tabular-nums`} />
                                <span className="text-slate-500">days (0 = any)</span>
                            </span>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">Licence disc expiring within</span>
                            <span className="flex items-center gap-2">
                                <input type="number" min={0} max={365} value={filters.licenceWithinDays} onChange={(e) => set({ licenceWithinDays: Number(e.target.value) })} className={`${field} w-20 tabular-nums`} />
                                <span className="text-slate-500">days (0 = any)</span>
                            </span>
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">Not in since</span>
                            <input type="date" value={filters.lastInBefore ?? ""} onChange={(e) => set({ lastInBefore: e.target.value })} className={`${field} w-full`} />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">A customer since</span>
                            <input type="date" value={filters.customerSince ?? ""} onChange={(e) => set({ customerSince: e.target.value })} className={`${field} w-full`} />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">Area (suburb, town or postcode)</span>
                            <input value={filters.area} onChange={(e) => set({ area: e.target.value })} placeholder="e.g. Windhoek" className={`${field} w-full`} />
                        </label>
                        <label className="space-y-1 text-sm">
                            <span className="text-slate-600">Vehicle (make, model or plate)</span>
                            <input value={filters.vehicle} onChange={(e) => set({ vehicle: e.target.value })} placeholder="e.g. Hilux" className={`${field} w-full`} />
                        </label>
                    </div>
                </section>

                <section className="rounded-sm border border-slate-200 bg-white">
                    <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">What it says</h2>
                    <div className="space-y-3 px-4 py-3">
                        <label className="block space-y-1 text-sm">
                            <span className="text-slate-600">Campaign name <span className="text-slate-400">(for your own list)</span></span>
                            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Licence discs expiring in October" className={`${field} w-full`} />
                        </label>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="flex overflow-hidden rounded-md border border-slate-300">
                                {(["WHATSAPP", "EMAIL"] as const).map((c) => (
                                    <button key={c} type="button" onClick={() => setChannel(c)} className={`px-3 py-1.5 text-sm ${channel === c ? "bg-teal-600 text-white" : "bg-white text-slate-600"}`}>
                                        {c === "WHATSAPP" ? "WhatsApp" : "Email"}
                                    </button>
                                ))}
                            </span>
                            <label className="flex items-center gap-2 text-slate-600">
                                <input type="checkbox" checked={usePreferred} onChange={(e) => setUsePreferred(e.target.checked)} className="accent-teal-600" />
                                Use each customer&rsquo;s preferred way, falling back to the other
                            </label>
                        </div>
                        {channel === "EMAIL" && (
                            <label className="block space-y-1 text-sm">
                                <span className="text-slate-600">Subject</span>
                                <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={`${field} w-full`} />
                            </label>
                        )}
                        <label className="block space-y-1 text-sm">
                            <span className="text-slate-600">Message</span>
                            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} maxLength={1500} className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm" />
                        </label>
                        <p className="text-xs text-slate-500">
                            Insert: {MERGE.map((f) => (
                                <button key={f} type="button" onClick={() => setBody((b) => `${b}{{${f}}}`)} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-slate-200">{`{{${f}}}`}</button>
                            ))}
                        </p>
                        <p className="text-xs text-slate-500">A line whose fields are all empty is left out of the message, so nobody gets &ldquo;your ().&rdquo;</p>
                        {wantsLink && (
                            <p className={`text-xs ${portalOn ? "text-slate-500" : "text-red-600"}`}>
                                {portalOn
                                    ? "{{link}} becomes each customer's own portal link, made when you send to them."
                                    : "{{link}} needs the customer portal, which is switched off. Turn it on in settings or take the link out."}
                            </p>
                        )}
                    </div>
                </section>
            </div>

            <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
                <section className="rounded-sm border border-slate-200 bg-white">
                    <h2 className="flex items-center gap-2 border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Users className="h-3.5 w-3.5" />Audience</h2>
                    <div className="px-4 py-3">
                        {loading && !preview ? <p className="text-sm text-slate-400">Counting…</p> : preview && (
                            <>
                                <p className="text-2xl font-bold tabular-nums text-slate-900">{preview.reachable}</p>
                                <p className="text-sm text-slate-500">
                                    {preview.reachable === 1 ? "customer can be reached" : "customers can be reached"}
                                    {loading && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
                                </p>
                                {preview.leftOut.length > 0 && (
                                    <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                                        {preview.leftOut.map((l) => <li key={l.reason}>{l.count} left out — {l.reason.toLowerCase()}</li>)}
                                    </ul>
                                )}
                                {preview.sample.length > 0 && (
                                    <ul className="mt-3 space-y-0.5 border-t border-slate-100 pt-2 text-xs text-slate-600">
                                        {preview.sample.map((s) => (
                                            <li key={s.name} className="truncate">{s.name}{s.owing > 0 ? ` · ${money(s.owing, currency)}` : s.vehicle ? ` · ${s.vehicle}` : ""}</li>
                                        ))}
                                        {preview.total > preview.sample.length && <li className="text-slate-400">and {preview.total - preview.sample.length} more…</li>}
                                    </ul>
                                )}
                            </>
                        )}
                    </div>
                </section>
                <Button type="button" className="w-full bg-teal-600 hover:bg-teal-700" disabled={creating || !preview || preview.reachable === 0} onClick={create}>
                    {creating ? "Preparing…" : `Prepare ${preview?.reachable ?? 0} message${preview?.reachable === 1 ? "" : "s"}`}
                </Button>
                <p className="text-xs text-slate-500">Nothing goes out yet. The next screen lists them, and you send each with a tap — WhatsApp opens on your phone, email in your mail app.</p>
                {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            </aside>
        </div>
    );
}
