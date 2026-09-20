import Link from "next/link";
import { notFound } from "next/navigation";
import { ScanLine } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { findSerial } from "@/lib/products/serial-service";
import { inWarranty, SERIAL_STATE_LABELS } from "@/lib/products/serials";
import { businessToday } from "@/lib/tenant/today";
import { dateShort } from "@/lib/format";

export const metadata = { title: "Find a serial number | MOTION Workshop Manager" };

export default async function SerialLookupPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ q?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "documents:see_cost")) notFound();
    const q = sp.q?.trim() ?? "";
    const results = q ? await findSerial(db, q) : [];
    const today = businessToday(tenant.timezone);
    const base = `/${slug}/dashboard`;

    return (
        <div className="max-w-4xl space-y-4">
            <div>
                <Link href={`${base}/products`} className="text-xs font-medium text-teal-700 hover:underline">← Products</Link>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><ScanLine className="h-6 w-6 text-slate-400" />Find a serial number</h1>
                <p className="text-sm text-slate-500">Someone is standing at the counter with a failed battery. Type the number off it.</p>
            </div>

            <form action={`${base}/products/serials`} method="get" className="flex gap-2">
                <input name="q" defaultValue={q} autoFocus placeholder="Serial number, or part of one" className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm" />
                <button type="submit" className="h-10 rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700">Find it</button>
            </form>

            {q && results.length === 0 && (
                <p className="rounded-sm border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    Nothing here matches &ldquo;{q}&rdquo;. It may have been sold before this system, or the number may be read wrong — try part of it.
                </p>
            )}

            {results.map((unit) => {
                const covered = inWarranty(unit.warrantyUntil, today);
                return (
                    <section key={unit.id} className="rounded-sm border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
                            <span className="font-mono text-sm font-semibold text-slate-800">{unit.serial}</span>
                            <span className="text-xs text-slate-500">{SERIAL_STATE_LABELS[unit.state]}</span>
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-4 py-3 text-sm">
                            <dt className="text-slate-500">What it is</dt>
                            <dd><Link href={`${base}/products/${unit.product.id}`} className="text-slate-800 hover:text-teal-700">{unit.product.itemCode} · {unit.product.description}</Link></dd>
                            {unit.supplier && (<>
                                <dt className="text-slate-500">Came from</dt>
                                <dd className="text-slate-700">{unit.supplier.supplier.companyName}{unit.supplier.supplierNumber ? ` · invoice ${unit.supplier.supplierNumber}` : ""}</dd>
                            </>)}
                            {unit.document && (<>
                                <dt className="text-slate-500">Sold on</dt>
                                <dd>
                                    <Link href={`${base}/documents/${unit.document.id}`} className="text-slate-800 hover:text-teal-700">{unit.document.number}</Link>
                                    <span className="text-slate-500">
                                        {unit.document.customer ? ` · ${unit.document.customer.firstName} ${unit.document.customer.lastName}` : ""}
                                        {unit.document.vehicle?.plate ? ` · ${unit.document.vehicle.plate}` : ""}
                                        {unit.soldAt ? ` · ${dateShort(unit.soldAt)}` : ""}
                                    </span>
                                </dd>
                            </>)}
                            <dt className="text-slate-500">Warranty</dt>
                            <dd className={covered ? "font-medium text-teal-700" : "text-slate-600"}>
                                {unit.warrantyUntil
                                    ? covered ? `In warranty until ${dateShort(unit.warrantyUntil)}` : `Ran out ${dateShort(unit.warrantyUntil)}`
                                    : unit.product.warrantyMonths
                                        ? `${unit.product.warrantyMonths} months from sale — not sold yet`
                                        : "This product carries no warranty period"}
                            </dd>
                        </dl>
                    </section>
                );
            })}
        </div>
    );
}
