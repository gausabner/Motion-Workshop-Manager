"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Clock, Wrench, AlertCircle, FileText, CheckCircle2, HelpCircle } from "lucide-react";
import type { JobStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { setJobStatus } from "@/lib/documents/actions";
import { BOARD_COLUMNS, JOB_STATUS_LABELS } from "@/lib/documents/types";
import { money } from "@/lib/format";
import type { getJobBoard } from "@/lib/documents/queries";

type Job = Awaited<ReturnType<typeof getJobBoard>>[number];

const COLUMN_STYLE: Record<string, { border: string; bg: string; icon: React.ReactNode }> = {
    BOOKED_IN: { border: "border-slate-200", bg: "bg-slate-100", icon: <FileText className="w-4 h-4 text-slate-500" /> },
    WORK_IN_PROGRESS: { border: "border-blue-200", bg: "bg-blue-50", icon: <Wrench className="w-4 h-4 text-blue-500" /> },
    WAITING_FOR_PARTS: { border: "border-orange-200", bg: "bg-orange-50", icon: <AlertCircle className="w-4 h-4 text-orange-500" /> },
    WAITING_FOR_CUSTOMER_APPROVAL: { border: "border-amber-200", bg: "bg-amber-50", icon: <HelpCircle className="w-4 h-4 text-amber-500" /> },
    JOB_COMPLETE: { border: "border-green-200", bg: "bg-green-50", icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
};

const initials = (name?: string | null) => (name ? name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase() : null);

export function JobBoard({ tenant, jobs, showCost }: { tenant: string; jobs: Job[]; showCost: boolean }) {
    const [pending, start] = useTransition();

    function move(id: string, status: JobStatus) {
        start(async () => { await setJobStatus(tenant, id, status); });
    }

    return (
        <div className={`flex h-[calc(100vh-190px)] gap-4 overflow-x-auto pb-4 ${pending ? "opacity-70" : ""}`}>
            {BOARD_COLUMNS.map((column) => {
                const columnJobs = jobs.filter((j) => j.jobStatus === column);
                const style = COLUMN_STYLE[column];
                const value = columnJobs.reduce((s, j) => s + j.total, 0);
                return (
                    <div key={column} className="flex flex-col w-[320px] shrink-0">
                        <div className={`flex items-center justify-between p-3 mb-3 rounded-lg border ${style.border} ${style.bg}`}>
                            <div className="flex items-center gap-2 font-semibold text-sm">
                                {style.icon}
                                {JOB_STATUS_LABELS[column]}
                            </div>
                            <div className="flex items-center gap-2">
                                {showCost && value > 0 && <span className="text-[10px] tabular-nums text-slate-500">{money(value)}</span>}
                                <Badge variant="secondary">{columnJobs.length}</Badge>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pb-2 pr-1">
                            {columnJobs.map((job) => (
                                <div key={job.id} className="rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <Link href={`/${tenant}/dashboard/documents/${job.id}`} className="block p-3">
                                        <div className="flex justify-between items-start mb-2 gap-2">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm leading-tight truncate">
                                                    {job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : "Cash sale"}
                                                </p>
                                                <p className="text-xs text-slate-500 truncate">{job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}` : "No vehicle"}</p>
                                            </div>
                                            <Badge variant="outline" className="font-mono text-[10px] shrink-0">{job.jobNumber ?? "—"}</Badge>
                                        </div>

                                        {job.vehicle && (
                                            <div className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 text-[11px] font-bold px-2 py-0.5 rounded shadow-sm mb-2">
                                                {job.vehicle.plate}
                                            </div>
                                        )}
                                        {job.statusComment && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{job.statusComment}</p>}

                                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1" title="Labour hours"><Clock className="w-3.5 h-3.5" />{job.labourHours}h</span>
                                                <span className="flex items-center gap-1" title="Lines"><Wrench className="w-3.5 h-3.5" />{job._count.lines}</span>
                                                {job.total > 0 && <span className="tabular-nums font-medium text-slate-600">{money(job.total)}</span>}
                                            </div>
                                            {job.mechanic ? (
                                                <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px] bg-slate-200">{initials(`${job.mechanic.user.firstName} ${job.mechanic.user.lastName}`)}</AvatarFallback></Avatar>
                                            ) : (
                                                <div className="h-6 w-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400" title="No mechanic assigned">+</div>
                                            )}
                                        </div>
                                    </Link>
                                    <div className="border-t border-slate-100 px-3 py-1.5">
                                        <label className="sr-only" htmlFor={`move-${job.id}`}>Move job {job.jobNumber} to another status</label>
                                        <select
                                            id={`move-${job.id}`}
                                            value={job.jobStatus ?? column}
                                            onChange={(e) => move(job.id, e.target.value as JobStatus)}
                                            className="w-full h-7 rounded-sm border border-slate-200 bg-white px-1 text-xs text-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
                                        >
                                            {BOARD_COLUMNS.map((s) => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
                                        </select>
                                    </div>
                                </div>
                            ))}

                            {columnJobs.length === 0 && (
                                <div className="h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">Empty</div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
