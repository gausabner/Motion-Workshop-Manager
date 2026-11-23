import Link from "next/link";
import { requireFeature } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { requisitionList, storesCounts, waitingOnMe, type ListShow } from "@/lib/requisitions/view";
import { RaiseButton } from "@/components/requisitions/RaiseButton";
import { tabTitle } from "@/lib/copy/terms";

export const metadata = { title: tabTitle("Requisitions") };

const TABS: { show: ListShow; label: string }[] = [
    { show: "waiting", label: "Waiting on you" },
    { show: "mine", label: "Mine" },
    { show: "issue", label: "To issue" },
    { show: "quotes", label: "Quotations" },
    { show: "open", label: "Open" },
    { show: "closed", label: "Closed" },
];
type Show = ListShow;

/**
 * The requisitions: what waits on the person looking, their own, what
 * stores has to issue, everything open, and the closed record. Approvers open
 * on what waits on them, stores on what it has to issue, everyone else on
 * their own.
 */
export default async function RequisitionsPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ show?: string }> }) {
    const [{ tenant: slug }, { show: asked }] = await Promise.all([params, searchParams]);
    const { db, tenant, membership } = await requireFeature(slug, "requisitions");
    const waiting = await waitingOnMe(db, tenant, membership);
    const stores = can(membership, "requisitions:issue");
    const driver = membership.designations.includes("PARTS_DRIVER");
    const fallback: Show = waiting.length ? "waiting" : stores ? "issue" : driver ? "quotes" : "mine";
    const show: Show = TABS.some((t) => t.show === asked) ? (asked as Show) : fallback;
    const [rows, counts] = await Promise.all([requisitionList(db, tenant, { show, viewerId: membership.id, waitingIds: waiting }), stores || driver ? storesCounts(db) : Promise.resolve({ issue: 0, quotes: 0 })]);
    const count: Partial<Record<Show, number>> = { waiting: waiting.length, issue: counts.issue, quotes: counts.quotes };
    const base = `/${slug}/dashboard/requisitions`;
    const money = (n: number) => n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const day = (d: Date | string, year = false) =>
        new Date(typeof d === "string" ? `${d}T00:00:00Z` : d).toLocaleDateString("en-GB", { timeZone: typeof d === "string" ? "UTC" : tenant.timezone, day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });

    return (
        <div className="mx-auto max-w-6xl space-y-4 pb-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">Requisitions</h1>
                    <p className="text-sm text-slate-600">Parts and supplies asked for, approved, issued from stores, and bought.</p>
                </div>
                {can(membership, "requisitions:raise") && (
                    <div className="flex flex-wrap items-start gap-2">
                        <RaiseButton tenant={slug} kind="PURCHASE" label="New purchase requisition" quiet />
                        <RaiseButton tenant={slug} label="New stores requisition" />
                    </div>
                )}
            </div>
            <nav aria-label="Which requisitions" className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
                {TABS.map((t) => (
                    <Link
                        key={t.show}
                        href={`${base}?show=${t.show}`}
                        aria-current={t.show === show ? "page" : undefined}
                        className={`-mb-px whitespace-nowrap border-b px-3 py-2 text-sm pointer-coarse:min-h-11 ${t.show === show ? "border-teal-700 font-medium text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
                    >
                        {t.label}
                        {/* A real space, so a screen reader says "Quotations 1", not "Quotations1". */}
                        {!!count[t.show] && <> <span className="tabular-nums text-slate-600">{count[t.show]}</span></>}
                    </Link>
                ))}
            </nav>
            {rows.length === 0 ? (
                <p className="border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                    {show === "waiting"
                        ? "No requisitions are waiting on you."
                        : show === "issue"
                          ? "Nothing approved is waiting to be issued."
                          : show === "quotes"
                            ? "No purchase requisition is waiting for quotations."
                            : show === "mine"
                            ? "You have not raised a requisition yet."
                            : show === "open"
                              ? "No requisitions are open."
                              : "No requisitions have been closed, rejected or cancelled."}
                </p>
            ) : (
                <table role="table" data-mobile="cards" className="w-full border border-slate-200 bg-white text-sm">
                    <thead role="rowgroup">
                        <tr role="row" className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                            <th role="columnheader" scope="col" className="px-4 py-2 font-semibold">Number</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">{show === "issue" || show === "quotes" ? "Needed by" : "Raised"}</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">Workshop</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">By</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 font-semibold">Charged to</th>
                            <th role="columnheader" scope="col" className="py-2 pr-3 text-right font-semibold">Value, {tenant.currency}</th>
                            <th role="columnheader" scope="col" className="py-2 pr-4 font-semibold">Where it is</th>
                        </tr>
                    </thead>
                    <tbody role="rowgroup">
                        {rows.map((r) => (
                            // The whole row opens it; the number is the link, stretched across the row.
                            <tr role="row" key={r.id} className="relative border-t border-slate-100 even:bg-slate-50/60 hover:bg-slate-50">
                                <td role="cell" data-mobile="primary" className="px-4 py-2 font-medium">
                                    <Link href={`${base}/${r.id}`} className="tabular-nums text-slate-900 after:absolute after:inset-0 hover:text-teal-700">{r.number ?? "Draft"}</Link>
                                </td>
                                <td role="cell" data-label={show === "issue" || show === "quotes" ? "Needed by" : "Raised"} className="whitespace-nowrap py-2 pr-3 tabular-nums text-slate-600">
                                    {show === "issue" || show === "quotes" ? (r.requiredBy ? day(r.requiredBy, true) : "—") : day(r.createdAt, true)}
                                </td>
                                <td role="cell" data-label="Workshop" className="py-2 pr-3 text-slate-700">{r.workshop ?? "—"}</td>
                                <td role="cell" data-label="By" className="py-2 pr-3 text-slate-700">{r.requestedBy}</td>
                                <td role="cell" data-label="Charged to" className="py-2 pr-3 tabular-nums text-slate-700">{r.charge ?? "—"}</td>
                                <td role="cell" data-label={`Value, ${tenant.currency}`} className="py-2 pr-3 text-right tabular-nums">{money(r.value)}</td>
                                <td role="cell" data-label="Where it is" className="py-2 pr-4 text-slate-700">{r.stateLabel}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
