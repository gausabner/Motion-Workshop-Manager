import Link from "next/link";
import { requireFeature } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { requisitionList, waitingOnMe, STATE_LABEL } from "@/lib/requisitions/view";
import { RaiseButton } from "@/components/requisitions/RaiseButton";
import { tabTitle } from "@/lib/copy/terms";

export const metadata = { title: tabTitle("Requisitions") };

const TABS = [
    { show: "waiting", label: "Waiting on you" },
    { show: "mine", label: "Mine" },
    { show: "issue", label: "To issue" },
    { show: "open", label: "Open" },
    { show: "closed", label: "Closed" },
] as const;
type Show = (typeof TABS)[number]["show"];

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
    const fallback: Show = waiting.length ? "waiting" : stores ? "issue" : "mine";
    const show: Show = TABS.some((t) => t.show === asked) ? (asked as Show) : fallback;
    const rows = await requisitionList(db, { show, viewerId: membership.id, waitingIds: waiting });
    const base = `/${slug}/dashboard/requisitions`;
    const money = (n: number) => n.toLocaleString("en-NA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="mx-auto max-w-6xl space-y-4 pb-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Requisitions</h1>
                    <p className="text-sm text-slate-500">Parts and supplies asked for, approved, and issued from stores.</p>
                </div>
                {can(membership, "requisitions:raise") && <RaiseButton tenant={slug} />}
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
                        {t.show === "waiting" && waiting.length > 0 && <span className="ml-1 tabular-nums text-slate-500">{waiting.length}</span>}
                    </Link>
                ))}
            </nav>
            {rows.length === 0 ? (
                <p className="border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    {show === "waiting" ? "Nothing is waiting on you." : show === "issue" ? "Nothing approved is waiting to be issued." : show === "mine" ? "You have not raised a requisition yet." : "None here."}
                </p>
            ) : (
                <table data-mobile="cards" className="w-full border border-slate-200 bg-white text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-slate-500">
                            <th scope="col" className="px-4 py-2 font-semibold">Number</th>
                            <th scope="col" className="py-2 pr-3 font-semibold">Raised</th>
                            <th scope="col" className="py-2 pr-3 font-semibold">Workshop</th>
                            <th scope="col" className="py-2 pr-3 font-semibold">By</th>
                            <th scope="col" className="py-2 pr-3 font-semibold">Charged to</th>
                            <th scope="col" className="py-2 pr-3 text-right font-semibold">Value</th>
                            <th scope="col" className="py-2 pr-4 font-semibold">Where it is</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100 even:bg-slate-50/60 hover:bg-slate-50">
                                <td data-mobile="primary" className="px-4 py-2 font-medium"><Link href={`${base}/${r.id}`} className="text-slate-900 hover:text-teal-700">{r.number ?? "Draft"}</Link></td>
                                <td data-label="Raised" className="py-2 pr-3 tabular-nums text-slate-600">{r.createdAt.toLocaleDateString("en-GB", { timeZone: tenant.timezone, day: "numeric", month: "short" })}</td>
                                <td data-label="Workshop" className="py-2 pr-3 text-slate-700">{r.workshop ?? "—"}</td>
                                <td data-label="By" className="py-2 pr-3 text-slate-700">{r.requestedBy}</td>
                                <td data-label="Charged to" className="py-2 pr-3 tabular-nums text-slate-700">{r.charge ?? "—"}</td>
                                <td data-label="Value" className="py-2 pr-3 text-right tabular-nums">{money(r.value)}</td>
                                <td data-label="Where it is" className="py-2 pr-4 text-slate-700">{STATE_LABEL[r.state]}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
