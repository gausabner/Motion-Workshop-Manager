"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { adjustStockAction, recountAction } from "@/lib/products/actions";

/**
 * Stock on hand, and the two ways it legitimately changes by hand: a
 * correction with a reason, and a rebuild from the movements themselves.
 */
export function StockPanel({ tenant, productId, onHand, minQty, tracked, canWrite }: {
    tenant: string; productId: string; onHand: number; minQty: number; tracked: boolean; canWrite: boolean;
}) {
    const [state, action, saving] = useActionState(adjustStockAction.bind(null, tenant, productId), initialActionState);
    const [recounted, setRecounted] = useState<string>();
    const [checking, startCheck] = useTransition();

    return (
        <section className="rounded-sm border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-2">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Stock on hand</h2>
                {canWrite && tracked && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-slate-500" disabled={checking}
                        onClick={() => startCheck(async () => setRecounted((await recountAction(tenant, productId)).message))}>
                        {checking ? "Checking…" : "Check against movements"}
                    </Button>
                )}
            </div>
            {!tracked ? (
                <p className="px-4 py-3 text-sm text-slate-500">Stock is not counted for this one.</p>
            ) : (
                <>
                    <div className="flex items-baseline gap-3 px-4 py-3">
                        <span className={`text-3xl font-bold tabular-nums ${onHand < 0 ? "text-red-700" : onHand <= minQty ? "text-amber-700" : "text-slate-900"}`}>{onHand}</span>
                        <span className="text-sm text-slate-500">{onHand < 0 ? "more sold than booked in — check it" : onHand <= minQty ? `at or below the minimum of ${minQty}` : `minimum ${minQty}`}</span>
                    </div>
                    {recounted && <p className="px-4 pb-2 text-xs text-teal-700">{recounted}</p>}
                    {canWrite && (
                        <form action={action} className="flex flex-wrap items-end gap-2 border-t border-slate-100 px-4 py-3">
                            <label className="space-y-1 text-xs text-slate-500">
                                <span className="block">Change by</span>
                                <input name="quantity" inputMode="decimal" placeholder="e.g. 4 or -1" className="h-8 w-24 rounded-md border border-slate-300 px-2 text-sm tabular-nums" />
                            </label>
                            <label className="space-y-1 text-xs text-slate-500">
                                <span className="block">Because</span>
                                <select name="kind" className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
                                    <option value="ADJUSTMENT">Correction or write-off</option>
                                    <option value="STOCKTAKE">Counted the shelf</option>
                                    <option value="OPENING">Opening stock</option>
                                </select>
                            </label>
                            <label className="flex-1 space-y-1 text-xs text-slate-500">
                                <span className="block">Note</span>
                                <input name="note" placeholder="e.g. delivery from Autoparts, invoice 4471" className="h-8 w-full min-w-48 rounded-md border border-slate-300 px-2 text-sm" />
                            </label>
                            <Button type="submit" size="sm" variant="outline" className="h-8" disabled={saving}>{saving ? "…" : "Record"}</Button>
                            {state.message && <p className={`w-full text-xs ${state.ok ? "text-teal-700" : "text-red-600"}`}>{state.message}</p>}
                            {state.errors && <p className="w-full text-xs text-red-600">{Object.values(state.errors).flat()[0]}</p>}
                        </form>
                    )}
                </>
            )}
        </section>
    );
}
