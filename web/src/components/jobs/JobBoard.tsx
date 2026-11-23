"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Clock, ListOrdered } from "lucide-react";
import type { JobStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import { setJobStatus } from "@/lib/documents/actions";
import { BOARD_COLUMNS, JOB_STATUS_LABELS } from "@/lib/documents/types";
import { blockStatus } from "@/components/diary/shared";
import { money } from "@/lib/format";
import type { getJobBoard } from "@/lib/documents/queries";

type Job = Awaited<ReturnType<typeof getJobBoard>>[number];

const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`.trim();
const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/**
 * Open job cards by status. Each column says its status the way the diary
 * does, an icon and its words, and nothing is told by a tint alone. Moving a
 * job is a choice and then Move: a select that moved the job on every arrow
 * key (which Windows does) sent it to the wrong column and lost its place.
 */
export function JobBoard({ tenant, jobs, showCost }: { tenant: string; jobs: Job[]; showCost: boolean }) {
    const [pending, start] = useTransition();
    const [said, setSaid] = useState("");

    function move(job: Job, status: JobStatus) {
        start(async () => {
            await setJobStatus(tenant, job.id, status);
            setSaid(`Moved ${job.jobNumber ?? "the job"} to ${JOB_STATUS_LABELS[status]}.`);
        });
    }

    // Focusable and named, so the columns past the edge of the screen can be
    // scrolled to with the arrow keys and a screen reader says what this is.
    return (
        <>
            <p role="status" className="sr-only">{said}</p>
            <div
                role="region"
                aria-label="Job board"
                tabIndex={0}
                className={`flex h-[calc(100vh-190px)] snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-4 md:snap-none ${pending ? "opacity-70" : ""}`}
            >
                {BOARD_COLUMNS.map((column) => {
                    const columnJobs = jobs.filter((j) => j.jobStatus === column);
                    const status = blockStatus(column);
                    const value = columnJobs.reduce((s, j) => s + j.total, 0);
                    return (
                        <section key={column} aria-labelledby={`column-${column}`} className="flex w-72 shrink-0 snap-center flex-col border border-slate-200 bg-slate-50 sm:w-80">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
                                <h2 id={`column-${column}`} className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <status.Icon className="h-4 w-4 text-slate-600" aria-hidden="true" strokeWidth={1.75} />
                                    {status.label}
                                </h2>
                                <div className="flex items-center gap-2 text-xs tabular-nums">
                                    {showCost && value > 0 && <span className="text-slate-600">{money(value)}</span>}
                                    <span className="min-w-6 border border-slate-200 px-1.5 py-0.5 text-center font-semibold text-slate-800">
                                        {columnJobs.length}<span className="sr-only"> {columnJobs.length === 1 ? "job" : "jobs"}</span>
                                    </span>
                                </div>
                            </div>

                            <ul className="flex-1 space-y-2 overflow-y-auto p-2">
                                {columnJobs.map((job) => (
                                    <JobCard key={job.id} tenant={tenant} job={job} column={column} onMove={move} />
                                ))}
                                {columnJobs.length === 0 && <li className="px-1 py-3 text-xs text-slate-500">No jobs here.</li>}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </>
    );
}

function JobCard({ tenant, job, column, onMove }: { tenant: string; job: Job; column: JobStatus; onMove: (job: Job, status: JobStatus) => void }) {
    const current = (job.jobStatus ?? column) as JobStatus;
    const [target, setTarget] = useState<JobStatus>(current);
    const who = job.customer ? fullName(job.customer) : "Cash sale";
    const mechanic = job.mechanic ? fullName(job.mechanic.user) : null;
    return (
        <li className="border border-slate-200 bg-white transition-colors duration-150 hover:border-[var(--motion-field-edge)]">
            <Link href={`/${tenant}/dashboard/documents/${job.id}`} className="block p-3">
                <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold leading-tight text-slate-900">{who}</span>
                        <span className="block truncate text-xs text-slate-600">{job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}` : "No vehicle"}</span>
                    </span>
                    <span className="shrink-0 border border-slate-200 px-1.5 text-[11px] font-medium tabular-nums text-slate-700">{job.jobNumber ?? "—"}</span>
                </span>
                {job.vehicle && <span className="mt-2 inline-block rounded-sm bg-yellow-100 px-1.5 text-[11px] font-bold text-yellow-900">{job.vehicle.plate}</span>}
                {job.statusComment && <span className="mt-2 block text-xs text-slate-600 line-clamp-2">{job.statusComment}</span>}
                <span className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
                    <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{job.labourHours} h<span className="sr-only"> labour</span></span>
                        <span className="flex items-center gap-1"><ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />{job._count.lines}<span className="sr-only"> {job._count.lines === 1 ? "line" : "lines"}</span></span>
                        {job.total > 0 && <span className="font-medium tabular-nums text-slate-800">{money(job.total)}</span>}
                    </span>
                    {mechanic ? (
                        <span className="flex items-center gap-1" title={mechanic}>
                            <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold text-slate-800">{initials(mechanic)}</span>
                            <span className="sr-only">{mechanic}</span>
                        </span>
                    ) : (
                        <span className="text-slate-500">No mechanic</span>
                    )}
                </span>
            </Link>
            <div className="flex items-center gap-1.5 border-t border-slate-100 px-3 py-1.5">
                <select
                    aria-label={`Status for ${job.jobNumber ?? who}`}
                    value={target}
                    onChange={(e) => setTarget(e.target.value as JobStatus)}
                    className={`${fieldClass} h-7 min-w-0 flex-1 px-1 text-xs`}
                >
                    {BOARD_COLUMNS.map((s) => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
                </select>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={target === current} onClick={() => onMove(job, target)}>
                    Move<span className="sr-only"> {job.jobNumber ?? who}</span>
                </Button>
            </div>
        </li>
    );
}
