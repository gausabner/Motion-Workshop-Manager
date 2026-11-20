import Link from "next/link";
import { requireFeature } from "@/lib/auth/session";
import { onSite, viewer } from "@/lib/fleet/queries";
import { KIND_LABEL, mayAccept, PURPOSE_LABEL } from "@/lib/fleet/route-rules";
import { JobStatusPill } from "@/components/documents/StatusPill";
import { AcceptButton } from "@/components/fleet/AcceptButton";
import { duration } from "@/lib/fleet/format";
import { tabTitle } from "@/lib/copy/terms";

export const metadata = { title: tabTitle("On site") };

const ORDER = { RECEPTION: 0, CHECK_BAY: 1, WORKSHOP: 2, BAY: 3 } as const;

/**
 * Every vehicle on site, by where it is: reception, the check bay, each
 * workshop and bay. What is there, for how long, and what is on its way. A
 * foreman opens on their own workshop; reception on reception.
 */
const PLACE_SAYS: string[] = ["BOOKED_IN", "INSPECTION_IN_PROGRESS", "WORK_IN_PROGRESS"];

export default async function OnSitePage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ at?: string }> }) {
    const [{ tenant: slug }, { at }] = await Promise.all([params, searchParams]);
    const { db, membership } = await requireFeature(slug, "jobFlow");
    const [vehicles, places, person] = await Promise.all([
        onSite(db),
        db.workshop.findMany({ where: { archivedAt: null }, select: { id: true, name: true, kind: true } }),
        viewer(db, membership.id),
    ]);
    const sorted = [...places].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.name.localeCompare(b.name));
    const mine = sorted.find((p) => person.foremanOf.includes(p.id)) ?? (person.designations.includes("RECEPTION") ? sorted.find((p) => p.kind === "RECEPTION") : undefined);
    const focus = at === "all" ? null : (sorted.find((p) => p.id === at) ?? (at ? null : mine) ?? null);
    const shown = focus ? [focus] : sorted;
    const base = `/${slug}/dashboard`;

    return (
        <div className="mx-auto max-w-6xl space-y-4 pb-16">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">On site</h1>
                <p className="text-sm text-slate-500">Every vehicle in the workshop, by where it is now.</p>
            </div>
            <nav aria-label="Places" className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0">
                {[{ id: "all", name: "Everywhere" }, ...sorted].map((p) => {
                    const current = p.id === "all" ? !focus : focus?.id === p.id;
                    const count = p.id === "all" ? vehicles.length : vehicles.filter((v) => v.workshopId === p.id).length;
                    return (
                        <Link
                            key={p.id}
                            href={`${base}/flow?at=${p.id}`}
                            aria-current={current ? "page" : undefined}
                            className={`relative -mb-px shrink-0 whitespace-nowrap border-b px-3 py-2 text-sm pointer-coarse:min-h-11 ${current ? "border-teal-700 font-medium text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"}`}
                        >
                            {p.name} <span className="tabular-nums text-slate-500">{count}</span>
                        </Link>
                    );
                })}
            </nav>
            {sorted.length === 0 && <p className="text-sm text-slate-500">No workshops or bays are set up yet. An owner adds them in Settings, under Workshops and bays.</p>}
            {shown.map((place) => {
                const here = vehicles.filter((v) => v.workshopId === place.id);
                const arriving = here.filter((v) => v.arriving).length;
                return (
                    <section key={place.id} className="border border-slate-200 bg-white">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
                            <h2 className="text-sm font-semibold text-slate-900">{place.name}{place.name.toLowerCase() !== KIND_LABEL[place.kind].toLowerCase() && <span className="font-normal text-slate-500"> · {KIND_LABEL[place.kind]}</span>}</h2>
                            <span className="tabular-nums text-xs text-slate-500">{here.length - arriving} here{arriving ? ` · ${arriving} on the way` : ""}</span>
                        </div>
                        {here.length === 0 ? (
                            <p className="px-4 py-4 text-sm text-slate-500">Nothing here.</p>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {here.map((v) => (
                                    <li key={v.visitId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                                        <Link href={`${base}/documents/${v.documentId}`} className="min-w-24 font-medium text-slate-900 hover:text-teal-700">{v.jobNumber}</Link>
                                        <span className="min-w-28 font-medium tabular-nums text-slate-800">{v.plate ?? "—"}{v.fleetCode && <span className="ml-1 font-normal text-slate-500">({v.fleetCode})</span>}</span>
                                        <span className="min-w-0 flex-1 truncate text-slate-600">{[v.vehicle, v.owner].filter(Boolean).join(" · ") || "—"}</span>
                                        <span className="text-xs text-slate-500">
                                            {PURPOSE_LABEL[v.purpose]}
                                            {place.kind === "CHECK_BAY" && !v.arriving && (v.purpose === "ASSESSMENT" || v.purpose === "QUALITY_CHECK") && (
                                                v.check ? (
                                                    <Link href={`${base}/inspections/${v.check.id}`} className="ml-1 text-teal-700 hover:underline">
                                                        {v.check.left ? `· ${v.check.left} of ${v.check.total} to check` : "· checked, to sign"}
                                                    </Link>
                                                ) : (
                                                    " · not started"
                                                )
                                            )}
                                        </span>
                                        {/* Where it is says booked in, inspecting or in progress already; only a status that adds something shows. */}
                                        {v.jobStatus && !PLACE_SAYS.includes(v.jobStatus) && <JobStatusPill status={v.jobStatus} />}
                                        <span className="w-24 text-right tabular-nums text-xs text-slate-500">{v.arriving ? `on the way ${duration(v.minutes)}` : duration(v.minutes)}</span>
                                        {v.arriving && mayAccept(person, place) && <AcceptButton tenant={slug} documentId={v.documentId} visitId={v.visitId} />}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
