"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LINE_TYPE_LABELS, PRODUCT_TO_LINE_TYPE } from "@/lib/documents/types";
import { calculateLine, round2 } from "@/lib/documents/totals";
import { money } from "@/lib/format";
import type { EditorOptions } from "@/lib/documents/queries";
import type { LineType } from "@prisma/client";

export type EditorLine = {
    key: string;
    id?: string;
    productId: string | null;
    lineType: LineType;
    description: string;
    quantity: number;
    unitPrice: number;
    unitCost: number;
    vatRate: number;
    discountPercent: number;
    serialNumbers: string | null;
    isCustomerSupplied: boolean;
};

type Props = {
    lines: EditorLine[];
    /** The state setter itself, so rapid edits queue instead of overwriting each other. */
    onChange: React.Dispatch<React.SetStateAction<EditorLine[]>>;
    products: EditorOptions["products"];
    pricesIncludeTax: boolean;
    salesTaxRate: number;
    showCost: boolean;
    readOnly: boolean;
};

const cell = "h-8 w-full rounded-sm border border-slate-200 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500";
const num = `${cell} text-right tabular-nums`;

export function newLine(vatRate: number): EditorLine {
    return {
        key: `new-${Math.random().toString(36).slice(2)}`,
        productId: null,
        lineType: "STOCK",
        description: "",
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        vatRate,
        discountPercent: 0,
        serialNumbers: null,
        isCustomerSupplied: false,
    };
}

export function LineGrid({ lines, onChange, products, pricesIncludeTax, salesTaxRate, showCost, readOnly }: Props) {
    function update(index: number, patch: Partial<EditorLine>) {
        onChange((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    }

    /** Picking a product fills description, price, cost, VAT and line type in one go. */
    function pickProduct(index: number, itemCode: string) {
        const p = products.find((x) => x.itemCode.toLowerCase() === itemCode.trim().toLowerCase());
        if (!p) {
            update(index, { productId: null });
            return;
        }
        onChange((prev) =>
            prev.map((l, i) =>
                i === index
                    ? {
                          ...l,
                          productId: p.id,
                          description: p.description,
                          unitPrice: p.retailPrice,
                          unitCost: p.costExTax,
                          vatRate: p.vatExempt ? 0 : salesTaxRate,
                          lineType: PRODUCT_TO_LINE_TYPE[p.type],
                          quantity: p.type === "LABOUR" && p.defaultLabourQty ? p.defaultLabourQty : l.quantity || 1,
                      }
                    : l,
            ),
        );
    }

    const codeOf = (productId: string | null) => products.find((p) => p.id === productId)?.itemCode ?? "";

    return (
        <div className="border border-slate-200 rounded-sm bg-white">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Items</h3>
                {!readOnly && (
                    <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => onChange((prev) => [...prev, newLine(salesTaxRate)])}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Add line
                    </Button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                    <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <th className="w-6"></th>
                            <th className="text-left font-semibold px-2 py-1.5 w-28">Code</th>
                            <th className="text-left font-semibold px-2 py-1.5">Description</th>
                            <th className="text-left font-semibold px-2 py-1.5 w-28">Type</th>
                            <th className="text-right font-semibold px-2 py-1.5 w-20">Qty</th>
                            <th className="text-right font-semibold px-2 py-1.5 w-28">Unit price</th>
                            {showCost && <th className="text-right font-semibold px-2 py-1.5 w-28">Unit cost</th>}
                            <th className="text-right font-semibold px-2 py-1.5 w-16">Disc %</th>
                            <th className="text-right font-semibold px-2 py-1.5 w-16">VAT %</th>
                            <th className="text-right font-semibold px-2 py-1.5 w-28">Line total</th>
                            {!readOnly && <th className="w-8"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {lines.length === 0 && (
                            <tr><td colSpan={showCost ? 11 : 10} className="px-4 py-8 text-center text-sm text-slate-500">
                                No items yet. {readOnly ? "" : "Add a line, or type a product code to pull in its price."}
                            </td></tr>
                        )}
                        {lines.map((line, i) => {
                            const t = calculateLine(line, pricesIncludeTax);
                            const margin = t.lineSubtotal > 0 ? round2(((t.lineSubtotal - t.cost) / t.lineSubtotal) * 100) : 0;
                            return (
                                <tr key={line.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                                    <td className="text-center text-slate-300"><GripVertical className="w-3.5 h-3.5 inline" /></td>
                                    <td className="px-1 py-1">
                                        <input
                                            className={cell}
                                            list="product-codes"
                                            defaultValue={codeOf(line.productId)}
                                            disabled={readOnly}
                                            placeholder="—"
                                            onChange={(e) => pickProduct(i, e.target.value)}
                                            aria-label={`Product code, line ${i + 1}`}
                                        />
                                    </td>
                                    <td className="px-1 py-1">
                                        <input className={cell} value={line.description} disabled={readOnly} onChange={(e) => update(i, { description: e.target.value })} placeholder="What was done or supplied" aria-label={`Description, line ${i + 1}`} />
                                    </td>
                                    <td className="px-1 py-1">
                                        <select className={cell} value={line.lineType} disabled={readOnly} onChange={(e) => update(i, { lineType: e.target.value as LineType })} aria-label={`Type, line ${i + 1}`}>
                                            {Object.entries(LINE_TYPE_LABELS).filter(([k]) => k !== "FREIGHT").map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-1 py-1"><input type="number" step="0.01" className={num} value={line.quantity} disabled={readOnly} onChange={(e) => update(i, { quantity: Number(e.target.value) })} aria-label={`Quantity, line ${i + 1}`} /></td>
                                    <td className="px-1 py-1"><input type="number" step="0.01" min="0" className={num} value={line.unitPrice} disabled={readOnly} onChange={(e) => update(i, { unitPrice: Number(e.target.value) })} aria-label={`Unit price, line ${i + 1}`} /></td>
                                    {showCost && (
                                        <td className="px-1 py-1">
                                            <input type="number" step="0.01" min="0" className={num} value={line.unitCost} disabled={readOnly} onChange={(e) => update(i, { unitCost: Number(e.target.value) })} aria-label={`Unit cost, line ${i + 1}`} />
                                            {t.cost > 0 && <span className={`block text-[10px] text-right pr-1 ${margin < 0 ? "text-red-600" : "text-slate-400"}`}>{margin}% margin</span>}
                                        </td>
                                    )}
                                    <td className="px-1 py-1"><input type="number" step="0.01" min="0" max="100" className={num} value={line.discountPercent} disabled={readOnly} onChange={(e) => update(i, { discountPercent: Number(e.target.value) })} aria-label={`Discount percent, line ${i + 1}`} /></td>
                                    <td className="px-1 py-1"><input type="number" step="0.01" min="0" max="100" className={num} value={line.vatRate} disabled={readOnly} onChange={(e) => update(i, { vatRate: Number(e.target.value) })} aria-label={`VAT percent, line ${i + 1}`} /></td>
                                    <td className="px-2 py-1 text-right tabular-nums font-medium text-slate-700">{money(t.lineTotal)}</td>
                                    {!readOnly && (
                                        <td className="px-1 py-1 text-center">
                                            <button type="button" onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" aria-label={`Remove line ${i + 1}`} title="Remove line">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <datalist id="product-codes">
                {products.map((p) => <option key={p.id} value={p.itemCode}>{p.description}</option>)}
            </datalist>
        </div>
    );
}
