"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Wrench, MoreHorizontal, Clock, AlertCircle, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

// Mock Data representing backend Job Cards
const MOCK_JOBS = [
    {
        id: "jc_1",
        customer_name: "Sarah Connor",
        vehicle_make: "Toyota",
        vehicle_model: "Hilux",
        registration_number: "T800-SKY",
        status: "IN_PROGRESS",
        created_at: new Date(new Date().setHours(8, 30)),
        assigned_mechanic: "Mike Engine",
        mechanic_initials: "ME",
        total_parts: 3,
        total_labor_hours: 2.5,
        is_waiting: false,
    },
    {
        id: "jc_2",
        customer_name: "John Wick",
        vehicle_make: "Ford",
        vehicle_model: "Mustang",
        registration_number: "JW-1969",
        status: "WAITING_ON_PARTS",
        created_at: new Date(new Date().setHours(9, 15)),
        assigned_mechanic: "Mike Engine",
        mechanic_initials: "ME",
        total_parts: 0,
        total_labor_hours: 1.0,
        is_waiting: true,
    },
    {
        id: "jc_3",
        customer_name: "Bruce Wayne",
        vehicle_make: "Batmobile",
        vehicle_model: "Tumbler",
        registration_number: "GTHM-1",
        status: "DRAFT",
        created_at: new Date(new Date().setHours(11, 0)),
        assigned_mechanic: null,
        mechanic_initials: null,
        total_parts: 0,
        total_labor_hours: 0,
        is_waiting: false,
    },
    {
        id: "jc_4",
        customer_name: "Tony Stark",
        vehicle_make: "Audi",
        vehicle_model: "R8",
        registration_number: "STRK-1",
        status: "COMPLETED",
        created_at: new Date(new Date().setDate(new Date().getDate() - 1)),
        assigned_mechanic: "Sarah Smith",
        mechanic_initials: "SS",
        total_parts: 5,
        total_labor_hours: 4.0,
        is_waiting: false,
    }
];

const COLUMNS = [
    { id: "DRAFT", title: "New / Draft", border: "border-slate-200", bg: "bg-slate-100", icon: <FileText className="w-4 h-4 text-slate-500" /> },
    { id: "IN_PROGRESS", title: "In Progress", border: "border-blue-200", bg: "bg-blue-50", icon: <Wrench className="w-4 h-4 text-blue-500" /> },
    { id: "WAITING_ON_PARTS", title: "Waiting on Parts", border: "border-orange-200", bg: "bg-orange-50", icon: <AlertCircle className="w-4 h-4 text-orange-500" /> },
    { id: "COMPLETED", title: "Completed / QC", border: "border-green-200", bg: "bg-green-50", icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
];

export function JobKanbanBoard({ tenant }: { tenant: string }) {
    const [jobs, setJobs] = useState(MOCK_JOBS);

    // In a real app we would use react-beautiful-dnd or dnd-kit here.
    // For the MVP, we render the static columns representing state.

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6 overflow-x-auto pb-4">
            {COLUMNS.map(column => {
                const columnJobs = jobs.filter(j => j.status === column.id);

                return (
                    <div key={column.id} className="flex flex-col w-[350px] shrink-0">
                        {/* Column Header */}
                        <div className={`flex items-center justify-between p-3 mb-3 rounded-lg border ${column.border} ${column.bg}`}>
                            <div className="flex items-center gap-2 font-semibold text-sm">
                                {column.icon}
                                {column.title}
                            </div>
                            <Badge variant="secondary">{columnJobs.length}</Badge>
                        </div>

                        {/* Column Cards Container */}
                        <div className="flex-1 overflow-y-auto space-y-3 pb-2 pr-2">
                            {columnJobs.map(job => (
                                <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow border-slate-200">
                                    <Link href={`/${tenant}/dashboard/jobs/${job.id}`}>
                                        <CardContent className="p-4">
                                            {/* RO Header */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <p className="font-semibold text-sm leading-none mb-1">{job.customer_name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {job.vehicle_make} {job.vehicle_model}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="font-mono text-xs">#{job.id.split('_')[1]}</Badge>
                                            </div>

                                            {/* Rego Plate Spec */}
                                            <div className="inline-block bg-yellow-100 border border-yellow-400 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded shadow-sm mb-4">
                                                {job.registration_number}
                                            </div>

                                            {/* Job Metrics Footer */}
                                            <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
                                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1" title="Labor hours">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {job.total_labor_hours}h
                                                    </span>
                                                    <span className="flex items-center gap-1" title="Parts attached">
                                                        <Wrench className="w-3.5 h-3.5" />
                                                        {job.total_parts}
                                                    </span>
                                                </div>

                                                {job.assigned_mechanic ? (
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-[10px] bg-slate-200">{job.mechanic_initials}</AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <div className="h-6 w-6 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                                                        +
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Link>
                                </Card>
                            ))}

                            {columnJobs.length === 0 && (
                                <div className="h-24 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-sm text-slate-400">
                                    No jobs
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
