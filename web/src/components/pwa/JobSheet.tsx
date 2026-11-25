"use client";

import { useEffect, useState, useTransition } from "react";
import { CloudOff, Play, X } from "lucide-react";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@ui-sdk/react/drawer";
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { Meter, MeterLabel, MeterTrack, MeterIndicator, MeterValue } from "@ui-sdk/react/meter";
import { hoursLabel } from "@/lib/time/clock";
import { jobSheetAction } from "@/lib/time/floor-actions";
import type { JobSheetData } from "@/lib/time/floor-sheet";

type View = "work" | "findings" | "parts";

const HERE_FOR: Record<string, string> = {
    INTAKE: "booked in", ASSESSMENT: "for assessment", WORK: "for work", QUALITY_CHECK: "for its quality check", RELEASE: "ready for collection",
};

/**
 * One job, opened from its card or from the schedule: the work without
 * prices, what the check bay found, the parts, who else is on it, and the
 * time against the estimate. It slides up over the floor and is read with
 * one thumb; Start sits at the bottom where the clock bar's Stop is.
 */
export function JobSheet({
    tenant, jobId, onClose, start, startLabel = "Start", onTheClock,
}: {
    tenant: string;
    jobId: string | null;
    onClose: () => void;
    /** Starts the clock on this job, when it is one of today's; null when it can only be read. */
    start: (() => void) | null;
    /** What Start says, as the cards say it: "Start", or "Switch to this job" while another runs. */
    startLabel?: string;
    onTheClock: boolean;
}) {
    const [data, setData] = useState<JobSheetData | null>(null);
    const [failed, setFailed] = useState(false);
    const [view, setView] = useState<View>("work");
    const [loading, load] = useTransition();
    const [shownFor, setShownFor] = useState<string | null>(null);

    // A new job resets the sheet to its work, then reads it.
    if (jobId && jobId !== shownFor) {
        setShownFor(jobId);
        setView("work");
        setFailed(false);
        setData((d) => (d?.id === jobId ? d : null));
    }
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!jobId) return;
        load(async () => {
            try {
                const sheet = await jobSheetAction(tenant, jobId);
                setData(sheet);
                setFailed(!sheet);
            } catch {
                setFailed(true);
            }
        });
    }, [tenant, jobId, attempt]);

    const vehicle = data?.vehicle ? `${data.vehicle.make} ${data.vehicle.model}`.trim() : null;
    const title = data?.description ?? vehicle ?? "Job";
    const counts = { work: data?.lines.length ?? 0, findings: data?.findings.length ?? 0, parts: data?.parts.length ?? 0 };
    const over = data?.time.estimate ? data.time.team - data.time.estimate : null;

    return (
        <Drawer open={!!jobId} onOpenChange={(open) => { if (!open) onClose(); }} side="bottom">
            <DrawerBackdrop className="fixed inset-0 bg-slate-900/40" />
            <DrawerContent className="mx-auto max-w-lg sm:border-x sm:border-slate-300 flex max-h-[88dvh] w-full flex-col border-t border-slate-300 bg-white [scale:calc(1-var(--drawer-stack,0)*0.04)]">
                <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300" />
                <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-2">
                    <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                            {data?.jobNumber && <span className="font-semibold text-slate-900">{data.jobNumber}</span>}
                            {data?.vehicle && <span className="rounded-sm bg-yellow-100 px-1.5 font-bold text-yellow-900">{data.vehicle.plate}</span>}
                            {/* The vehicle is the title when the job has no description, so it is not said twice. */}
                            {(data?.description ? vehicle : null) && <span className="text-slate-600">{vehicle}</span>}
                            {data?.odometer ? <span className="tabular-nums text-slate-600">{data.odometer.toLocaleString("en-GB")} km</span> : null}
                        </p>
                        <DrawerTitle className="mt-1 text-lg font-semibold leading-snug text-slate-900">{data ? title : loading ? "Opening the job…" : "Job"}</DrawerTitle>
                        <DrawerDescription className="text-sm text-slate-600">
                            {[data?.department, data?.place ? (data.place.arrived ? `At ${data.place.name}, ${HERE_FOR[data.place.purpose] ?? "on its route"}` : `On its way to ${data.place.name}`) : null].filter(Boolean).join(" · ") || " "}
                        </DrawerDescription>
                    </div>
                    <DrawerClose aria-label="Close the job" className="floor-press -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-sm text-slate-600 active:bg-slate-100">
                        <X className="h-5 w-5" aria-hidden="true" />
                    </DrawerClose>
                </div>

                {failed && !data && (
                    <p className="mx-4 mb-4 flex items-start gap-2 border border-slate-300 px-3 py-3 text-base text-slate-800">
                        <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">The job could not be opened. It needs a signal.</span>
                        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="floor-press -my-1 h-10 shrink-0 rounded-sm border border-slate-300 px-3 text-sm font-medium text-slate-800 active:bg-slate-50">
                            {loading ? "Trying…" : "Try again"}
                        </button>
                    </p>
                )}

                {data && (
                    <>
                        {data.note && (
                            <p className="mx-4 mb-3 rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                                &ldquo;{data.note.text}&rdquo;{data.note.from ? <span className="text-slate-600"> · {data.note.from}</span> : null}
                            </p>
                        )}
                        <SegmentedControl
                            aria-label="Job details"
                            value={view}
                            onValueChange={(next) => next && setView(next as View)}
                            className="mx-4 grid shrink-0 grid-cols-3 border border-slate-300"
                        >
                            {(["work", "findings", "parts"] as const).map((v) => (
                                <SegmentedControlItem
                                    key={v}
                                    value={v}
                                    className="floor-press h-11 border-r border-slate-300 text-sm font-medium text-slate-700 last:border-r-0 data-[checked]:bg-teal-700 data-[checked]:text-white"
                                >
                                    {v === "work" ? "Work" : v === "findings" ? "Findings" : "Parts"}
                                    {counts[v] > 0 && <span className="ml-1 tabular-nums opacity-80">{counts[v]}</span>}
                                </SegmentedControlItem>
                            ))}
                        </SegmentedControl>

                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
                            {view === "work" && (
                                data.lines.length ? (
                                    <ul className="divide-y divide-slate-100 border-y border-slate-100">
                                        {data.lines.map((l) => (
                                            <li key={l.id} className="flex items-baseline justify-between gap-3 py-2.5 text-base text-slate-900">
                                                <span className="min-w-0">{l.description}</span>
                                                <span className="shrink-0 text-sm tabular-nums text-slate-600">{l.labour ? `${l.quantity} h` : `× ${l.quantity}`}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-base text-slate-600">No work lines yet. {data.description ? "The job card says only what is written above." : "Ask the foreman what is wanted."}</p>
                                )
                            )}
                            {view === "findings" && (
                                data.findings.length ? (
                                    <ul className="space-y-2">
                                        {data.findings.map((f, i) => (
                                            <li key={`${f.description}-${i}`} className={`rounded-sm border px-3 py-2 text-base ${f.urgent ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
                                                <span className="font-semibold">{f.urgent ? "Urgent" : "Soon"}:</span> {f.description}
                                                {f.comment && <span className="block text-sm opacity-90">{f.comment}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-base text-slate-600">Nothing marked urgent or soon on this job&rsquo;s checks.</p>
                                )
                            )}
                            {view === "parts" && (
                                data.parts.length ? (
                                    <ul className="divide-y divide-slate-100 border-y border-slate-100">
                                        {data.parts.map((p) => (
                                            <li key={p.id} className="py-2.5">
                                                <p className="flex items-baseline justify-between gap-3 text-base">
                                                    <span className="font-semibold text-slate-900">{p.number ?? "Draft"}</span>
                                                    <span className="text-sm text-slate-700">{p.state}</span>
                                                </p>
                                                <p className="text-sm text-slate-600">{p.items}</p>
                                                {p.waitingFor && <p className="text-sm text-slate-800">Still to come: {p.waitingFor}</p>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-base text-slate-600">No parts requested for this job.</p>
                                )
                            )}

                            {data.crew.length > 0 && (
                                <div className="mt-5">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">On the job here</p>
                                    <p className="mt-1 text-base text-slate-900">
                                        {data.crew.map((c) => `${c.me ? "You" : c.name}${c.lead ? " (lead)" : ""}`).join(" · ")}
                                    </p>
                                </div>
                            )}

                            <div className="mt-5">
                                {data.time.estimate ? (
                                    <Meter value={data.time.team} min={0} max={data.time.estimate} format={(v: number) => `${hoursLabel(v)} of ${hoursLabel(data.time.estimate!)}`}>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <MeterLabel className="text-xs font-semibold uppercase tracking-wider text-slate-600">Time on the job</MeterLabel>
                                            <MeterValue className="text-sm tabular-nums text-slate-900" />
                                        </div>
                                        <MeterTrack className="mt-1.5 h-2 overflow-hidden rounded-sm bg-slate-200">
                                            <MeterIndicator className="h-full bg-teal-700" />
                                        </MeterTrack>
                                    </Meter>
                                ) : (
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Time on the job</p>
                                )}
                                <p className="mt-1 text-sm tabular-nums text-slate-700">
                                    You {hoursLabel(data.time.mine)} · Everyone {hoursLabel(data.time.team)}
                                    {over !== null && over > 0 ? ` · ${hoursLabel(over)} over the estimate` : ""}
                                </p>
                            </div>
                        </div>
                    </>
                )}

                <div className="shrink-0 border-t border-slate-200 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3">
                    {onTheClock ? (
                        <p className="flex h-14 items-center justify-center rounded-sm border border-teal-700 text-lg font-semibold text-teal-800">On the clock</p>
                    ) : start ? (
                        <button type="button" onClick={start} className="floor-press flex h-14 w-full items-center justify-center gap-2 rounded-sm bg-teal-700 text-lg font-semibold text-white active:bg-teal-800">
                            <Play className="h-5 w-5" aria-hidden="true" />{startLabel}
                        </button>
                    ) : (
                        <DrawerClose className="floor-press flex h-14 w-full items-center justify-center rounded-sm border border-slate-300 text-lg font-semibold text-slate-800 active:bg-slate-50">Close</DrawerClose>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
