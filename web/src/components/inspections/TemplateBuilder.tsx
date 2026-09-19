"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { move, parseReadings, type TemplateDraft } from "@/lib/inspections/template-rules";
import { saveTemplateAction } from "@/lib/inspections/template-actions";

type Product = { id: string; label: string; type: string; price: number };
type Item = { key: string; id?: string; description: string; readings: string; productId: string; estimate: string };
type Group = { key: string; name: string; items: Item[] };

let counter = 0;
const key = () => `k${++counter}`;
const blankItem = (): Item => ({ key: key(), description: "", readings: "", productId: "", estimate: "" });

const TYPE_LABELS: Record<string, string> = { LABOUR: "Labour", SUBLET: "Sublet", STOCK: "Parts", CONSUMABLE: "Consumables", ACCESSORY: "Accessories", TYRE: "Tyres" };
const field = "h-8 rounded-md border border-slate-300 bg-white px-2 text-sm";

function fromDraft(draft: TemplateDraft): Group[] {
    return draft.groups.map((g) => ({
        key: key(), name: g.name,
        items: g.items.map((it) => ({
            key: key(), id: it.id, description: it.description, readings: it.inputs.join(", "),
            productId: it.productId ?? "", estimate: it.defaultEstimate === null ? "" : String(it.defaultEstimate),
        })),
    }));
}

function toDraft(name: string, groups: Group[]) {
    return {
        name,
        groups: groups.map((g) => ({
            name: g.name,
            items: g.items.map((it) => ({
                ...(it.id ? { id: it.id } : {}),
                description: it.description,
                inputs: parseReadings(it.readings),
                productId: it.productId || null,
                defaultEstimate: it.estimate.trim() === "" ? null : Number(it.estimate.replace(",", ".")),
            })),
        })),
    };
}

/**
 * The checklist a mechanic will work through, edited as they will see it:
 * groups in order, checks in order within them. Nothing is saved until Save,
 * and the whole template saves at once, so a half-edited list never reaches a
 * mechanic's phone.
 */
export function TemplateBuilder({ tenant, id, initial, products, currencySymbol }: { tenant: string; id: string; initial: TemplateDraft; products: Product[]; currencySymbol: string }) {
    const router = useRouter();
    const [name, setName] = useState(initial.name);
    const [groups, setGroups] = useState<Group[]>(() => fromDraft(initial));
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [saving, start] = useTransition();
    const snapshot = useMemo(() => JSON.stringify(toDraft(initial.name, fromDraft(initial)).groups.map((g) => [g.name, g.items.map((i) => [i.description, i.inputs, i.productId, i.defaultEstimate])])), [initial]);
    const dirty = name !== initial.name || JSON.stringify(toDraft(name, groups).groups.map((g) => [g.name, g.items.map((i) => [i.description, i.inputs, i.productId, i.defaultEstimate])])) !== snapshot;

    // After a save the server hands back the template with ids on every new check; start from that,
    // or the next save would treat those checks as new again and cut their link to past inspections.
    const serverVersion = JSON.stringify(initial);
    const [loadedVersion, setLoadedVersion] = useState(serverVersion);
    if (loadedVersion !== serverVersion) {
        setLoadedVersion(serverVersion);
        setName(initial.name);
        setGroups(fromDraft(initial));
    }

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const byType = useMemo(() => {
        const map = new Map<string, Product[]>();
        for (const p of products) map.set(p.type, [...(map.get(p.type) ?? []), p]);
        return [...map.entries()];
    }, [products]);
    const checks = groups.reduce((n, g) => n + g.items.length, 0);

    const setGroup = (gi: number, patch: Partial<Group>) => setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
    const setItem = (gi: number, ii: number, patch: Partial<Item>) =>
        setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : g)));

    function pickProduct(gi: number, ii: number, productId: string) {
        const item = groups[gi].items[ii];
        const product = products.find((p) => p.id === productId);
        // A linked product's price is a sensible first estimate; an estimate someone typed is kept.
        setItem(gi, ii, { productId, ...(product && product.price > 0 && item.estimate.trim() === "" ? { estimate: String(product.price) } : {}) });
    }

    function save() {
        setStatus(null);
        start(async () => {
            const result = await saveTemplateAction(tenant, id, toDraft(name.trim(), groups));
            if (!result.ok) {
                setStatus({ ok: false, text: result.message });
                return;
            }
            setStatus({ ok: true, text: "Saved. New inspections use this from now on." });
            router.refresh();
        });
    }

    return (
        <div className="space-y-4 pb-24">
            <label className="block max-w-md space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Template name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className={`${field} h-9 w-full text-base font-medium`} />
            </label>

            {groups.map((g, gi) => (
                <section key={g.key} className="rounded-sm border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50 px-3 py-2">
                        <input value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} maxLength={60} aria-label="Group name" className={`${field} flex-1 min-w-40 font-semibold`} placeholder="Group, e.g. Brakes" />
                        <span className="text-xs text-slate-400">{g.items.length} check{g.items.length === 1 ? "" : "s"}</span>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={gi === 0} onClick={() => setGroups((gs) => move(gs, gi, -1))} aria-label="Move group up"><ArrowUp className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={gi === groups.length - 1} onClick={() => setGroups((gs) => move(gs, gi, 1))} aria-label="Move group down"><ArrowDown className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-700" disabled={groups.length === 1}
                            onClick={() => { if (g.items.every((it) => !it.description.trim()) || window.confirm(`Remove "${g.name || "this group"}" and its ${g.items.length} checks?`)) setGroups((gs) => gs.filter((_, i) => i !== gi)); }}
                            aria-label="Remove group"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {g.items.map((it, ii) => (
                            <li key={it.key} className="space-y-1.5 px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <input value={it.description} onChange={(e) => setItem(gi, ii, { description: e.target.value })} maxLength={160} placeholder="Check, e.g. Front brake pads" aria-label="Check" className={`${field} flex-1 font-medium`} />
                                    <button type="button" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={ii === 0} onClick={() => setGroup(gi, { items: move(g.items, ii, -1) })} aria-label="Move check up"><ArrowUp className="h-4 w-4" /></button>
                                    <button type="button" className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30" disabled={ii === g.items.length - 1} onClick={() => setGroup(gi, { items: move(g.items, ii, 1) })} aria-label="Move check down"><ArrowDown className="h-4 w-4" /></button>
                                    <button type="button" className="p-1 text-slate-400 hover:text-red-700 disabled:opacity-30" disabled={g.items.length === 1} onClick={() => setGroup(gi, { items: g.items.filter((_, j) => j !== ii) })} aria-label="Remove check"><Trash2 className="h-4 w-4" /></button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input value={it.readings} onChange={(e) => setItem(gi, ii, { readings: e.target.value })} placeholder="Readings, e.g. Left mm, Right mm" aria-label="Readings, up to four, separated by commas" className={`${field} min-w-44 flex-1 text-xs`} />
                                    <select value={it.productId} onChange={(e) => pickProduct(gi, ii, e.target.value)} aria-label="Becomes on the job card" className={`${field} min-w-44 flex-1 text-xs`}>
                                        <option value="">Labour line, priced by the estimate</option>
                                        {byType.map(([type, list]) => (
                                            <optgroup key={type} label={TYPE_LABELS[type] ?? type}>
                                                {list.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                                            </optgroup>
                                        ))}
                                    </select>
                                    <label className="flex items-center gap-1 text-xs text-slate-500">
                                        Usual price {currencySymbol}
                                        <input value={it.estimate} onChange={(e) => setItem(gi, ii, { estimate: e.target.value })} inputMode="decimal" placeholder="—" className={`${field} w-24 text-right tabular-nums`} />
                                    </label>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="border-t border-slate-100 px-3 py-2">
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-teal-700" onClick={() => setGroup(gi, { items: [...g.items, blankItem()] })}><Plus className="mr-1 h-3.5 w-3.5" />Add check</Button>
                    </div>
                </section>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={() => setGroups((gs) => [...gs, { key: key(), name: "", items: [blankItem()] }])}><Plus className="mr-1 h-4 w-4" />Add group</Button>

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-[180px]">
                <div className="mx-auto flex max-w-5xl items-center gap-3">
                    <span className="mr-auto text-sm">
                        {status ? <span className={status.ok ? "text-teal-700" : "text-red-600"} role={status.ok ? undefined : "alert"}>{status.text}</span>
                            : <span className="text-slate-500">{groups.length} group{groups.length === 1 ? "" : "s"}, {checks} check{checks === 1 ? "" : "s"}{dirty ? " · unsaved changes" : ""}</span>}
                    </span>
                    <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={saving || !dirty} onClick={save}>{saving ? "Saving…" : "Save template"}</Button>
                </div>
            </div>
        </div>
    );
}
