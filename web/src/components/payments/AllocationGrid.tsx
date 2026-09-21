"use client";

import type { PaymentDirection } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/types";
import { clampAllocation } from "@/lib/documents/settlement";
import { allocationTotal, byAge, spread, spreadRefund, type Allocations, type OpenItem } from "@/lib/payments/allocation";
import { dateShort, money } from "@/lib/format";

type Props = {
    items: OpenItem[];
    allocations: Allocations;
    onChange: (next: Allocations) => void;
    /** Signed: positive on a receipt, negative on a refund. */
    tendered: number;
    direction: PaymentDirection;
    readOnly?: boolean;
    loading?: boolean;
};

/**
 * What the money is being put against. One row per open document, credits
 * included — allocating a credit note here is how it gets used up, so a
 * receipt and a credit application are the same screen.
 *
 * A refund can only ever hand a credit note back, so invoices are hidden
 * rather than shown and refused.
 */
export function AllocationGrid({ items, allocations, onChange, tendered, direction, readOnly, loading }: Props) {
    const isRefund = direction === "REFUND";
    const ordered = [...items].filter((i) => (isRefund ? i.outstanding < 0 : true)).sort(byAge);
    const allocated = allocationTotal(allocations);

    const set = (item: OpenItem, raw: number) => {
        const amount = clampAllocation(item.outstanding, raw);
        const next = { ...allocations };
        if (amount === 0) delete next[item.id];
        else next[item.id] = amount;
        onChange(next);
    };

    return (
        <section className="border border-slate-200 rounded-sm bg-white">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{isRefund ? "Refund against" : "Apply to"}</h3>
                {!readOnly && (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button" size="sm" variant="outline" className="h-7" disabled={!ordered.length}
                            onClick={() => onChange(isRefund ? spreadRefund(items, Math.abs(tendered)) : spread(items, tendered))}
                        >
                            All
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-slate-500" onClick={() => onChange({})} disabled={!allocated}>
                            Clear
                        </Button>
                    </div>
                )}
            </div>

            {loading ? (
                <p className="px-4 py-6 text-sm text-slate-400">Looking up the account…</p>
            ) : ordered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">
                    {isRefund
                        ? "No open credit notes on this account. Anything paid out here comes off the money already sitting on the account."
                        : "Nothing is outstanding on this account. Anything tendered will sit as unapplied credit until there is an invoice to put it against."}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-xs">
                                <TableHead className="pl-4 text-slate-500 font-semibold">Date</TableHead>
                                <TableHead className="text-slate-500 font-semibold">Number</TableHead>
                                <TableHead className="text-slate-500 font-semibold">Type</TableHead>
                                <TableHead className="text-slate-500 font-semibold">Due</TableHead>
                                <TableHead className="text-right text-slate-500 font-semibold">Total</TableHead>
                                <TableHead className="text-right text-slate-500 font-semibold">Outstanding</TableHead>
                                <TableHead className="text-right pr-4 text-slate-500 font-semibold w-40">Applied</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ordered.map((item) => {
                                const value = allocations[item.id] ?? 0;
                                const isCredit = item.outstanding < 0;
                                return (
                                    <TableRow key={item.id} className="text-sm">
                                        <TableCell className="pl-4 py-1.5 tabular-nums text-slate-600 whitespace-nowrap">{dateShort(item.postDate)}</TableCell>
                                        <TableCell className="py-1.5 font-medium text-slate-700">{item.number ?? "—"}</TableCell>
                                        <TableCell className="py-1.5 text-slate-600 whitespace-nowrap">{DOCUMENT_TYPE_LABELS[item.type]}</TableCell>
                                        <TableCell className="py-1.5 tabular-nums text-slate-500 whitespace-nowrap">{item.dueDate ? dateShort(item.dueDate) : ""}</TableCell>
                                        <TableCell className="py-1.5 text-right tabular-nums text-slate-500">{money(item.total)}</TableCell>
                                        <TableCell className={`py-1.5 text-right tabular-nums font-medium ${isCredit ? "text-teal-700" : "text-slate-700"}`}>{money(item.outstanding)}</TableCell>
                                        <TableCell className="py-1.5 pr-4 text-right">
                                            <input
                                                type="number"
                                                step="0.01"
                                                inputMode="decimal"
                                                aria-label={`Amount applied to ${item.number ?? "this document"}`}
                                                disabled={readOnly}
                                                value={value === 0 ? "" : value}
                                                placeholder="0.00"
                                                // The benchmark fills the full balance the moment you pick a document; this is that, one field along.
                                                onFocus={(e) => {
                                                    if (!readOnly && !allocations[item.id]) {
                                                        set(item, item.outstanding);
                                                        requestAnimationFrame(() => e.target.select());
                                                    }
                                                }}
                                                onChange={(e) => set(item, Number(e.target.value))}
                                                className="h-7 w-32 rounded-sm border border-slate-300 bg-white px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500"
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
        </section>
    );
}
