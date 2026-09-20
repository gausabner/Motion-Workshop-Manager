"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { applyStockTakeAction, saveCountsAction } from "@/lib/stock/stocktake-actions";
import { summarise } from "@/lib/stock/stocktake";
import type { StockTakeRecord } from "@/lib/stock/stocktake-service";
import { money } from "@/lib/format";

const cell = "h-8 w-24 rounded-sm border border-slate-200 bg-white px-2 text-right text-sm tabular-nums disabled:bg-slate-50";

/**
 * The count sheet. A blind count hides what the ledger expects until it is
 * applied, so people write down what is on the shelf rather than agreeing
 * with the screen.
 */
export function StockTakeSheet({ tenant, take, currency }: { tenant: string; take: StockTakeRecord; currency: string }) {
    const router = useRouter();
    const editable = take.state === "DRAFT";
    const [counts, setCounts] = useState<Map<string, number | null>>(new Map(take.lines.map((l) => [l.id, l.counted])));
    const [filter, setFilter] = useState<"all" | "todo" | "differs">("all");
    const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, start] = useTransition();

    const withCounts = take.lines.map((l) => ({ ...l, counted: counts.get(l.id) ?? null }));
    const summary = summarise(withCounts.map((l) => ({ productId: l.productId, expected: l.expected, counted: l.counted, onHand: l.onHand, unitCost: l.unitCost })));
    const payload = () => [...counts].map(([lineId, counted]) => ({ lineId, counted }));

    const shown = withCounts.filter((l) => {
        if (filter === "todo") return l.counted === null;
        if (filter === "differs") return l.counted !== null && l.counted !== l.expected;
        return true;
    });

    const run = (work: () => Promise<{ ok: boolean; message?: string }>) => start(async () => {
        const result = await work();
        setStatus({ ok: result.ok, text: result.message ?? (result.ok ? "Saved" : "Not saved") });
        router.refresh();
    });

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
                {[
                    { label: "To count", value: `${summary.uncounted}`, tone: summary.uncounted > 0 ? "text-amber-700" : "text-slate-400" },
                    { label: "Agreeing", value: `${summary.agreeing}`, tone: "text-slate-700" },
                    { label: "Short / over", value: `${summary.short} / ${summary.over}`, tone: summary.short + summary.over > 0 ? "text-slate-900" : "text-slate-400" },
                    { label: take.blind && editable ? "Counted" : "Difference at cost", value: take.blind && editable ? `${summary.counted}` : money(summary.value, currency), tone: summary.value < 0 ? "text-red-700" : "text-teal-700" },
                ].map((tile) => (
                    <div key={tile.label} className="rounded-sm border border-slate-200 bg-white px-4 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{tile.label}</p>
                        <p className={`text-xl font-bold tabular-nums ${tile.tone}`}>{tile.value}</p>
                    </div>
                ))}
            </div>

            {summary.movedDuringCount > 0 && !take.blind && (
                <p className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                    {summary.movedDuringCount} {summary.movedDuringCount === 1 ? "product has" : "products have"} moved since this sheet was drawn up — sold or received while you counted.
                    They will be corrected against the ledger as it stands now, not against the sheet.
                </p>
            )}

            <section className="rounded-sm border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{take.lines.length} on the sheet</h2>
                    <span className="flex gap-1">
                        {(["all", "todo", "differs"] as const).map((f) => (
                            <button key={f} type="button" onClick={() => setFilter(f)}
                                className={`rounded px-2 py-1 text-xs ${filter === f ? "bg-teal-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>
                                {f === "all" ? "All" : f === "todo" ? "Still to count" : "Differences"}
                            </button>
                        ))}
                    </span>
                </div>
                <div className="grid grid-cols-12 gap-2 border-b bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <span className="col-span-3">Code</span><span className="col-span-4">Description</span><span className="col-span-1">Shelf</span>
                    <span className="col-span-2 text-right">{take.blind && editable ? "" : "Expected"}</span><span className="col-span-2 text-right">Counted</span>
                </div>
                <ul className="divide-y divide-slate-100">
                    {shown.length === 0 && <li className="px-4 py-4 text-center text-sm text-slate-500">Nothing here.</li>}
                    {shown.map((line) => {
                        const diff = line.counted === null ? null : Math.round((line.counted - line.expected) * 100) / 100;
                        return (
                            <li key={line.id} className="grid grid-cols-12 items-center gap-2 px-4 py-1.5 text-sm">
                                <span className="col-span-3 font-medium text-slate-800">{line.itemCode}</span>
                                <span className="col-span-4 truncate text-slate-600">{line.description}</span>
                                <span className="col-span-1 text-xs text-slate-400">{line.location ?? ""}</span>
                                <span className="col-span-2 text-right tabular-nums text-slate-500">
                                    {take.blind && editable ? <span className="text-slate-300">hidden</span> : line.expected}
                                    {!editable && line.onHand !== line.expected && <span className="block text-[10px] text-amber-700">now {line.onHand}</span>}
                                </span>
                                <span className="col-span-2 flex items-center justify-end gap-2">
                                    {editable ? (
                                        <input
                                            value={line.counted ?? ""} inputMode="decimal" placeholder="—"
                                            onChange={(e) => setCounts((m) => { const next = new Map(m); const raw = e.target.value.trim(); next.set(line.id, raw === "" ? null : Number(raw) || 0); return next; })}
                                            className={cell} aria-label={`Counted ${line.itemCode}`}
                                        />
                                    ) : <span className="tabular-nums text-slate-800">{line.counted ?? "—"}</span>}
                                    {diff !== null && diff !== 0 && (!take.blind || !editable) && (
                                        <span className={`w-10 text-right text-xs tabular-nums ${diff < 0 ? "text-red-700" : "text-teal-700"}`}>{diff > 0 ? `+${diff}` : diff}</span>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </section>

            {editable && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => saveCountsAction(tenant, take.id, payload()))}>{busy ? "Saving…" : "Save what is counted"}</Button>
                    <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={busy}
                        onClick={() => {
                            const left = summary.uncounted;
                            const warn = left > 0 ? `${left} of ${summary.lines} have not been counted. They will be left exactly as they are. Apply the rest?` : "Apply this count and correct the stock?";
                            if (window.confirm(warn)) run(() => applyStockTakeAction(tenant, take.id, payload()));
                        }}>
                        Apply the count
                    </Button>
                    {status && <p className={`text-sm ${status.ok ? "text-teal-700" : "text-red-600"}`} role={status.ok ? undefined : "alert"}>{status.text}</p>}
                </div>
            )}
            {!editable && status && <p className={`text-sm ${status.ok ? "text-teal-700" : "text-red-600"}`}>{status.text}</p>}
        </div>
    );
}
