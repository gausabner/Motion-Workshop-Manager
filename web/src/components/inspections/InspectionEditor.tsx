"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, RotateCcw, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SendDialog } from "@/components/messaging/SendDialog";
import { addApproved, decideForCustomer, finaliseInspection, removeFindingPhoto, reopenInspection, saveInspectionItems, sendForApproval, uploadFindingPhoto } from "@/lib/inspections/actions";
import { estimates, rag, type Rag } from "@/lib/inspections/rules";
import type { InspectionRecord } from "@/lib/inspections/queries";
import type { ItemPatch } from "@/lib/inspections/service";
import { money } from "@/lib/format";

type Item = InspectionRecord["items"][number];

const RAG_STYLE: Record<Rag, string> = {
    red: "border-red-500 bg-red-50",
    amber: "border-amber-400 bg-amber-50",
    green: "border-teal-400 bg-white",
    unchecked: "border-slate-200 bg-white",
};

const STATE_LABEL: Record<InspectionRecord["state"], string> = {
    DRAFT: "Draft", REQUESTED: "With the customer", APPROVED: "Answered", REFUSED: "All declined", FINALISED: "Finalised",
};

/**
 * One inspection, for the mechanic's phone and the counter's screen alike
 * (R5). Everything autosaves: a mechanic with a torch in one hand should not
 * lose a finding because they forgot a button.
 */
export function InspectionEditor({ tenant, inspection, canSend }: { tenant: string; inspection: InspectionRecord; canSend: boolean }) {
    const router = useRouter();
    const [items, setItems] = useState<Item[]>(inspection.items);
    const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [message, setMessage] = useState<string>();
    const [busy, start] = useTransition();
    const dirty = useRef(new Map<string, ItemPatch>());
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editable = inspection.state === "DRAFT";
    const totals = estimates(items);

    function flush() {
        if (timer.current) clearTimeout(timer.current);
        const patches = [...dirty.current.values()];
        dirty.current.clear();
        if (!patches.length) return Promise.resolve(true);
        setSaving("saving");
        return saveInspectionItems(tenant, inspection.id, patches).then((r) => {
            setSaving(r.ok ? "saved" : "error");
            if (!r.ok) setMessage(r.message);
            return r.ok;
        });
    }

    // Save whatever is pending if the page is left mid-edit.
    useEffect(() => () => void flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

    function change(id: string, patch: Omit<ItemPatch, "id">) {
        setItems((all) => all.map((i) => {
            if (i.id !== id) return i;
            const next = { ...i, ...patch, inputs: patch.inputs ?? i.inputs } as Item;
            if (patch.urgent || patch.soon || patch.inputs?.some(Boolean)) next.checked = true;
            return next;
        }));
        dirty.current.set(id, { ...(dirty.current.get(id) ?? { id }), ...patch, id });
        setSaving("saving");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 700);
    }

    function setRag(item: Item, value: Rag) {
        change(item.id, { urgent: value === "red", soon: value === "amber", checked: value !== "unchecked" });
    }

    function act(run: () => Promise<{ ok: boolean; message?: string }>) {
        setMessage(undefined);
        start(async () => {
            if (!(await flush())) return;
            const result = await run();
            setMessage(result.message);
            router.refresh();
        });
    }

    const groups = [...new Set(items.map((i) => i.group))];
    const answered = (i: Item) => (i.approvedAt ? "approved" : i.declinedAt ? "declined" : null);

    return (
        <div className="space-y-4 pb-24">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-800">
                        {inspection.vehicle && <span className="mr-2 rounded bg-yellow-100 px-1.5 text-yellow-900">{inspection.vehicle.plate}</span>}
                        {inspection.description ?? "Inspection"} {inspection.number}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {inspection.customer ? `${inspection.customer.firstName} ${inspection.customer.lastName}` : "No customer"}
                        {inspection.vehicle ? ` · ${[inspection.vehicle.year, inspection.vehicle.make, inspection.vehicle.model].filter(Boolean).join(" ")}` : ""}
                        {inspection.document && <> · <Link href={`/${tenant}/dashboard/documents/${inspection.document.id}`} className="text-teal-700 hover:underline">job {inspection.document.number ?? inspection.document.jobNumber}</Link></>}
                    </p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-600">{STATE_LABEL[inspection.state]}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-red-700">Urgent</p><p className="font-semibold tabular-nums text-red-800">{money(totals.urgent)}</p></div>
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-amber-700">Soon</p><p className="font-semibold tabular-nums text-amber-800">{money(totals.soon)}</p></div>
                <div className="rounded-md border border-teal-200 bg-teal-50 px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-teal-700">Approved</p><p className="font-semibold tabular-nums text-teal-800">{money(totals.approved)}</p></div>
            </div>

            {inspection.customerComments && (
                <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><span className="text-xs font-semibold uppercase tracking-wider text-slate-400">The customer wrote</span><br />&ldquo;{inspection.customerComments}&rdquo;</p>
            )}
            {inspection.customerViewedAt && <p className="text-xs text-teal-700">Opened by the customer {new Date(inspection.customerViewedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Windhoek" })}</p>}

            {groups.map((group) => (
                <section key={group} className="space-y-2">
                    <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{group}</h2>
                    {items.filter((i) => i.group === group).map((item) => {
                        const r = rag(item);
                        const flagged = item.urgent || item.soon;
                        return (
                            <article key={item.id} className={`rounded-lg border-2 p-3 ${RAG_STYLE[r]}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="font-medium text-slate-800">{item.description}</p>
                                    <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs font-semibold" role="radiogroup" aria-label={`${item.description} condition`}>
                                        {(["green", "amber", "red"] as const).map((value) => (
                                            <button
                                                key={value} type="button" role="radio" aria-checked={r === value} disabled={!editable}
                                                onClick={() => setRag(item, r === value ? "unchecked" : value)}
                                                className={`min-h-10 px-3 capitalize ${r === value ? (value === "red" ? "bg-red-600 text-white" : value === "amber" ? "bg-amber-500 text-white" : "bg-teal-600 text-white") : "bg-white text-slate-500"} disabled:cursor-default`}
                                            >
                                                {value === "green" ? "OK" : value === "amber" ? "Soon" : "Urgent"}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {item.inputLabels.length > 0 && (
                                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {item.inputLabels.map((label, n) => (
                                            <label key={n} className="text-xs text-slate-500">
                                                {label}
                                                <input
                                                    value={item.inputs[n] ?? ""} disabled={!editable} inputMode="decimal"
                                                    onChange={(e) => { const inputs = [...item.inputs]; inputs[n] = e.target.value; change(item.id, { inputs }); }}
                                                    className="mt-0.5 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-base tabular-nums text-slate-800 disabled:bg-slate-50"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {(flagged || item.comment) && (
                                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                                        <input
                                            value={item.comment ?? ""} disabled={!editable} placeholder="What you found — the customer reads this"
                                            onChange={(e) => change(item.id, { comment: e.target.value })}
                                            className="h-10 rounded-md border border-slate-300 bg-white px-2 text-base sm:col-span-3 disabled:bg-slate-50"
                                        />
                                        {flagged && (
                                            <input
                                                value={item.estimate ?? ""} disabled={!editable} inputMode="decimal" placeholder="Cost to fix"
                                                onChange={(e) => change(item.id, { estimate: e.target.value === "" ? null : Number(e.target.value) })}
                                                className="h-10 rounded-md border border-slate-300 bg-white px-2 text-right text-base tabular-nums disabled:bg-slate-50"
                                                aria-label="Cost to fix"
                                            />
                                        )}
                                    </div>
                                )}

                                <Photos tenant={tenant} inspectionId={inspection.id} item={item} editable={editable} onChange={(photos) => setItems((all) => all.map((i) => (i.id === item.id ? { ...i, photos } : i)))} />

                                {!editable && flagged && (
                                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2 text-sm">
                                        {answered(item) === "approved" && <span className="flex items-center gap-1 font-semibold text-teal-700"><Check className="h-4 w-4" />Approved{item.approvedBy ? ` · ${item.approvedBy}` : ""}</span>}
                                        {answered(item) === "declined" && <span className="flex items-center gap-1 font-semibold text-slate-500"><X className="h-4 w-4" />Declined{item.approvedBy ? ` · ${item.approvedBy}` : ""}</span>}
                                        {!answered(item) && <span className="text-slate-500">Waiting for the customer</span>}
                                        {item.documentLineId ? (
                                            <span className="text-xs text-teal-700">On the job card</span>
                                        ) : inspection.state !== "FINALISED" && (
                                            <span className="ml-auto flex gap-1">
                                                <Button type="button" size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => act(() => decideForCustomer(tenant, inspection.id, item.id, "approve"))}>Approve by phone</Button>
                                                <Button type="button" size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => act(() => decideForCustomer(tenant, inspection.id, item.id, "decline"))}>Declined</Button>
                                                {answered(item) && <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-400" disabled={busy} onClick={() => act(() => decideForCustomer(tenant, inspection.id, item.id, "clear"))}>Undo</Button>}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </section>
            ))}

            {/* The actions live in a bar that stays under the thumb. */}
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
                <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
                    <span className="mr-auto text-xs text-slate-500">
                        {saving === "saving" ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span> : saving === "saved" ? "All changes saved" : saving === "error" ? <span className="text-red-600">Not saved</span> : null}
                        {message && <span className="ml-2 text-slate-700">{message}</span>}
                    </span>
                    {editable && (
                        <Button type="button" size="sm" className="bg-teal-600 hover:bg-teal-700" disabled={busy} onClick={() => act(() => sendForApproval(tenant, inspection.id))}>
                            <Send className="mr-1 h-4 w-4" />Ready for the customer
                        </Button>
                    )}
                    {!editable && inspection.state !== "FINALISED" && (
                        <>
                            {canSend && inspection.customer && <SendDialog tenant={tenant} target={{ kind: "INSPECTION", id: inspection.id }} label={`inspection ${inspection.number ?? ""}`} />}
                            <Button type="button" size="sm" variant="outline" disabled={busy || !items.some((i) => i.approvedAt && !i.documentLineId)} onClick={() => act(() => addApproved(tenant, inspection.id))}>Add approved to job</Button>
                            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => act(() => finaliseInspection(tenant, inspection.id))}>Finalise</Button>
                            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => act(() => reopenInspection(tenant, inspection.id))}><RotateCcw className="mr-1 h-4 w-4" />Edit</Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Photos({ tenant, inspectionId, item, editable, onChange }: { tenant: string; inspectionId: string; item: Item; editable: boolean; onChange: (photos: Item["photos"]) => void }) {
    const input = useRef<HTMLInputElement>(null);
    const [pending, start] = useTransition();
    const [error, setError] = useState<string>();
    if (!editable && item.photos.length === 0) return null;
    return (
        <div className="mt-2 flex flex-wrap items-center gap-2">
            {item.photos.map((p) => (
                <span key={p.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- private, session-served files; next/image cannot optimise them */}
                    <img src={`/${tenant}/attachments/${p.id}`} alt={item.description} className="h-16 w-16 rounded-md border border-slate-200 object-cover" />
                    {editable && (
                        <button type="button" aria-label="Remove photo" onClick={() => start(async () => { await removeFindingPhoto(tenant, inspectionId, p.id); onChange(item.photos.filter((x) => x.id !== p.id)); })} className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-slate-500 shadow">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </span>
            ))}
            {editable && (
                <>
                    {/* capture opens the back camera straight away on a phone. */}
                    <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        setError(undefined);
                        start(async () => {
                            const body = new FormData();
                            body.set("file", file);
                            const r = await uploadFindingPhoto(tenant, inspectionId, item.id, body);
                            if (r.ok) onChange([...item.photos, { id: r.id, fileName: r.fileName }]);
                            else setError(r.message);
                        });
                    }} />
                    <button type="button" onClick={() => input.current?.click()} disabled={pending} className="flex h-16 w-16 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-500">
                        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}Photo
                    </button>
                    {error && <span className="text-xs text-red-600">{error}</span>}
                </>
            )}
        </div>
    );
}
