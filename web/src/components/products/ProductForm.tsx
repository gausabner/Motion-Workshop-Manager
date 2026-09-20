"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { initialActionState } from "@/lib/forms";
import { saveProduct } from "@/lib/products/actions";
import type { ProductRecord } from "@/lib/products/queries";

type Options = { groups: { id: string; name: string }[]; categories: { id: string; name: string }[]; suppliers: { id: string; companyName: string }[]; matrices: { id: string; name: string }[] };

const field = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm";
const label = "block space-y-1 text-sm";
const head = "border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500";

function Err({ of }: { of?: string[] }) {
    return of ? <p className="text-xs text-red-600">{of[0]}</p> : null;
}

/** Everything about a product except how much of it there is — that is the ledger's job. */
export function ProductForm({ tenant, product, options, currency }: { tenant: string; product: ProductRecord | null; options: Options; currency: string }) {
    const [state, action, saving] = useActionState(saveProduct.bind(null, tenant, product?.id ?? null), initialActionState);
    const e = state.errors;
    const margin = product && product.retailPrice > 0 ? Math.round(((product.retailPrice - product.costExTax) / product.retailPrice) * 100) : null;

    return (
        <form action={action} className="space-y-4">
            <section className="rounded-sm border border-slate-200 bg-white">
                <h2 className={head}>Details</h2>
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className={label}><span className="text-slate-600">Item code</span><input name="itemCode" defaultValue={product?.itemCode} className={field} required /><Err of={e?.itemCode} /></label>
                    <label className={`${label} sm:col-span-1 lg:col-span-2`}><span className="text-slate-600">Description</span><input name="description" defaultValue={product?.description} className={field} required /><Err of={e?.description} /></label>
                    <label className={label}><span className="text-slate-600">Type</span>
                        <select name="type" defaultValue={product?.type ?? "STOCK"} className={field}>
                            <option value="STOCK">Part</option><option value="LABOUR">Labour</option><option value="SUBLET">Sublet</option>
                            <option value="CONSUMABLE">Consumable</option><option value="ACCESSORY">Accessory</option><option value="TYRE">Tyre</option>
                        </select>
                    </label>
                    <label className={label}><span className="text-slate-600">Supplier</span>
                        <select name="supplierId" defaultValue={product?.supplierId ?? ""} className={field}>
                            <option value="">None</option>{options.suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName}</option>)}
                        </select>
                    </label>
                    <label className={label}><span className="text-slate-600">Group</span>
                        <select name="groupId" defaultValue={product?.groupId ?? ""} className={field}>
                            <option value="">None</option>{options.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </label>
                    <label className={label}><span className="text-slate-600">Category</span>
                        <select name="categoryId" defaultValue={product?.categoryId ?? ""} className={field}>
                            <option value="">None</option>{options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <label className={label}><span className="text-slate-600">Brand</span><input name="brand" defaultValue={product?.brand ?? ""} className={field} /></label>
                    <label className={label}><span className="text-slate-600">Shelf / location</span><input name="location" defaultValue={product?.location ?? ""} className={field} /></label>
                    <label className={label}><span className="text-slate-600">Labour hours by default</span><input name="defaultLabourQty" defaultValue={product?.defaultLabourQty ?? ""} inputMode="decimal" className={field} /></label>
                </div>
                <div className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-2 text-sm text-slate-600">
                    <label className="flex items-center gap-2"><input type="checkbox" name="isBundle" defaultChecked={product?.isBundle} className="accent-teal-600" />A bundle of other products</label>
                    <label className="flex items-center gap-2">Priced
                        <select name="bundlePricing" defaultValue={product?.bundlePricing ?? "FIXED"} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
                            <option value="FIXED">at the bundle price</option>
                            <option value="SUM">as the sum of what is in it</option>
                        </select>
                    </label>
                    <label className="flex items-center gap-2">Printed
                        <select name="bundlePrinting" defaultValue={product?.bundlePrinting ?? "COMPONENTS"} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm">
                            <option value="COMPONENTS">showing what is in it</option>
                            <option value="BUNDLE_ONLY">as one line</option>
                        </select>
                    </label>
                </div>
                <div className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-2 text-sm text-slate-600">
                    <label className="flex items-center gap-2"><input type="checkbox" name="isService" defaultChecked={product?.isService} className="accent-teal-600" />A service, not a thing on a shelf</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="dontUpdateQty" defaultChecked={product?.dontUpdateQty} className="accent-teal-600" />Do not count stock for this</label>
                    <label className="flex items-center gap-2"><input type="checkbox" name="vatExempt" defaultChecked={product?.vatExempt} className="accent-teal-600" />VAT exempt</label>
                </div>
            </section>

            <section className="rounded-sm border border-slate-200 bg-white">
                <h2 className={head}>Money</h2>
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-3 lg:grid-cols-5">
                    <label className={label}><span className="text-slate-600">Cost (excl. tax)</span><input name="costExTax" defaultValue={product?.costExTax ?? 0} inputMode="decimal" className={`${field} text-right tabular-nums`} /><Err of={e?.costExTax} /></label>
                    <label className={label}><span className="text-slate-600">Sell price</span><input name="retailPrice" defaultValue={product?.retailPrice ?? 0} inputMode="decimal" className={`${field} text-right tabular-nums`} /><Err of={e?.retailPrice} /></label>
                    <label className={label}><span className="text-slate-600">Price 2</span><input name="price2" defaultValue={product?.price2 ?? 0} inputMode="decimal" className={`${field} text-right tabular-nums`} /></label>
                    <label className={label}><span className="text-slate-600">Price 3</span><input name="price3" defaultValue={product?.price3 ?? 0} inputMode="decimal" className={`${field} text-right tabular-nums`} /></label>
                    <label className={label}><span className="text-slate-600">Price 4</span><input name="price4" defaultValue={product?.price4 ?? 0} inputMode="decimal" className={`${field} text-right tabular-nums`} /></label>
                    <label className={`${label} sm:col-span-2`}><span className="text-slate-600">Price follows</span>
                        <select name="priceMatrixId" defaultValue={product?.priceMatrixId ?? ""} className={field}>
                            <option value="">nothing — the sell price is whatever is typed here</option>
                            {options.matrices.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </label>
                </div>
                {margin !== null && (
                    <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
                        At those prices the margin is <strong className={margin < 0 ? "text-red-700" : "text-slate-700"}>{margin}%</strong> on each one sold, before any discount. Prices are in {currency}.
                        {product?.priceMatrixId ? " This product is on a price matrix, so its sell price follows its cost." : ""}
                    </p>
                )}
            </section>

            <section className="rounded-sm border border-slate-200 bg-white">
                <h2 className={head}>Reordering and notes</h2>
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className={label}><span className="text-slate-600">Minimum on hand</span><input name="minQty" defaultValue={product?.minQty ?? 0} inputMode="decimal" className={`${field} text-right tabular-nums`} /></label>
                    <label className={label}><span className="text-slate-600">Maximum on hand</span><input name="maxQty" defaultValue={product?.maxQty ?? 0} inputMode="decimal" className={`${field} text-right tabular-nums`} /></label>
                    <label className={`${label} lg:col-span-2`}><span className="text-slate-600">Note on the job card</span><input name="jobCardComment" defaultValue={product?.jobCardComment ?? ""} className={field} /></label>
                    <label className={`${label} sm:col-span-2 lg:col-span-4`}><span className="text-slate-600">Internal note</span><input name="comment" defaultValue={product?.comment ?? ""} className={field} /></label>
                </div>
            </section>

            <div className="flex items-center gap-3">
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700" disabled={saving}>{saving ? "Saving…" : product ? "Save" : "Create product"}</Button>
                {state.message && <p className={`text-sm ${state.ok ? "text-teal-700" : "text-red-600"}`} role={state.ok ? undefined : "alert"}>{state.message}</p>}
            </div>
        </form>
    );
}
