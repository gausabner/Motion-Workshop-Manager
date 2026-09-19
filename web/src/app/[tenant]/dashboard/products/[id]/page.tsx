import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getProduct, productOptions, productSales } from "@/lib/products/queries";
import { movementsFor } from "@/lib/stock/ledger";
import { marginOf, movesStock } from "@/lib/stock/rules";
import { ProductForm } from "@/components/products/ProductForm";
import { StockPanel } from "@/components/products/StockPanel";
import { ArchiveProductButton } from "@/components/products/ArchiveProductButton";
import { dateShortIn, money } from "@/lib/format";

export const metadata = { title: "Product | MOTION Workshop Manager" };

const KIND_LABEL: Record<string, string> = {
    SALE: "Sold", CREDIT: "Credited back", PURCHASE: "Bought in", RETURN_TO_SUPPLIER: "Returned to supplier",
    ADJUSTMENT: "Correction", STOCKTAKE: "Counted", OPENING: "Opening stock", VOID_REVERSAL: "Void put back",
};

/** Outside the component: reading the clock while rendering is impure. */
function aYearAgo(): Date {
    return new Date(Date.now() - 365 * 86_400_000);
}

export default async function ProductPage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
    const { tenant: slug, id } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "documents:see_cost")) notFound();
    const product = await getProduct(db, id);
    if (!product) notFound();
    const [options, movements, sales] = await Promise.all([productOptions(db), movementsFor(db, id), productSales(db, id, aYearAgo())]);

    // Every line is measured on its own document's tax basis, then added up.
    const margin = sales.reduce(
        (acc, line) => {
            const m = marginOf([line], line.pricesIncludeTax);
            return { sales: acc.sales + m.sales, cost: acc.cost + m.cost, profit: acc.profit + m.profit, qty: acc.qty + line.quantity };
        },
        { sales: 0, cost: 0, profit: 0, qty: 0 },
    );
    const percent = margin.sales === 0 ? null : Math.round((margin.profit / margin.sales) * 100);
    const base = `/${slug}/dashboard`;

    return (
        <div className="max-w-6xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link href={`${base}/products`} className="text-xs font-medium text-teal-700 hover:underline">← Products</Link>
                    <h1 className="mt-1 text-xl font-bold text-slate-800">{product.itemCode}</h1>
                    <p className="text-sm text-slate-500">{product.description}{product.archivedAt ? " · archived" : ""}</p>
                </div>
                {can(membership, "products:write") && <ArchiveProductButton tenant={slug} id={product.id} archived={!!product.archivedAt} />}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <ProductForm tenant={slug} product={product} options={options} currency={tenant.currency} />

                <div className="space-y-4">
                    <StockPanel
                        tenant={slug} productId={product.id} onHand={product.qtyOnHand} minQty={product.minQty}
                        tracked={movesStock(product)} canWrite={can(membership, "products:write")}
                    />

                    <section className="rounded-sm border border-slate-200 bg-white">
                        <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last 12 months</h2>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 text-sm">
                            <dt className="text-slate-500">Sold</dt><dd className="text-right tabular-nums text-slate-800">{margin.qty}</dd>
                            <dt className="text-slate-500">Sales</dt><dd className="text-right tabular-nums text-slate-800">{money(margin.sales, tenant.currency)}</dd>
                            <dt className="text-slate-500">Cost</dt><dd className="text-right tabular-nums text-slate-600">{money(margin.cost, tenant.currency)}</dd>
                            <dt className="font-medium text-slate-700">Profit</dt>
                            <dd className={`text-right font-semibold tabular-nums ${margin.profit < 0 ? "text-red-700" : "text-teal-700"}`}>{money(margin.profit, tenant.currency)}{percent !== null ? ` · ${percent}%` : ""}</dd>
                        </dl>
                        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Excluding tax, credit notes taken off.</p>
                    </section>

                    <section className="rounded-sm border border-slate-200 bg-white">
                        <h2 className="border-b bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Movements</h2>
                        {movements.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-slate-500">Nothing has moved yet.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100 text-sm">
                                {movements.map((m) => {
                                    const qty = m.quantity.toNumber();
                                    return (
                                        <li key={m.id} className="flex items-center gap-2 px-4 py-2">
                                            <span className={`w-12 text-right font-semibold tabular-nums ${qty < 0 ? "text-red-700" : "text-teal-700"}`}>{qty > 0 ? `+${qty}` : qty}</span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-xs text-slate-700">
                                                    {KIND_LABEL[m.kind] ?? m.kind}
                                                    {m.document && <> · <Link href={`${base}/documents/${m.document.id}`} className="hover:text-teal-700">{m.document.number ?? m.document.jobNumber}</Link></>}
                                                </span>
                                                <span className="block text-[11px] text-slate-400">{dateShortIn(m.at, tenant.timezone)}{m.by ? ` · ${m.by.user.firstName}` : ""}{m.note ? ` · ${m.note}` : ""}</span>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
