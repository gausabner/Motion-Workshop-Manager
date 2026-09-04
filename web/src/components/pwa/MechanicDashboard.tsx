"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timer, Wrench, ShieldAlert, CheckCircle2, ChevronRight, WifiOff, CloudSync, Clock, Settings, LogOut, ArrowLeft } from "lucide-react";
import Link from "next/link";

// Mock PWA State
const MOCK_JOBS = [
    { id: "job_1", vehicle: "Toyota Hilux", rego: "T800-SKY", service: "Logbook Service - Minor", timeAllocated: "1.5h", status: "IN_PROGRESS", isClockedIn: true },
    { id: "job_2", vehicle: "Ford Mustang", rego: "JW-1969", service: "Brake Pad Replacement", timeAllocated: "2.0h", status: "TODO", isClockedIn: false },
    { id: "job_3", vehicle: "Audi R8", rego: "STARK-1", service: "Diagnostic Scan", timeAllocated: "1.0h", status: "TODO", isClockedIn: false }
];

export function MechanicDashboard({ tenant }: { tenant: string }) {
    const [isOffline, setIsOffline] = useState(false);
    const [hasPendingSync, setHasPendingSync] = useState(false);
    const [jobs, setJobs] = useState(MOCK_JOBS);
    const [activeTab, setActiveTab] = useState("jobs");
    const [selectedJob, setSelectedJob] = useState<string | null>(null);

    // Simulate Network State
    useEffect(() => {
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => {
            setIsOffline(false);
            if (hasPendingSync) {
                // Simulate sync delay
                setTimeout(() => setHasPendingSync(false), 1500);
            }
        };

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
        };
    }, [hasPendingSync]);

    const handleClockIn = (jobId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setJobs(jobs.map(j => {
            if (j.id === jobId) return { ...j, isClockedIn: !j.isClockedIn, status: !j.isClockedIn ? "IN_PROGRESS" : "TODO" };
            return j;
        }));
        if (isOffline) setHasPendingSync(true);
    };

    if (selectedJob) {
        const job = jobs.find(j => j.id === selectedJob);
        if (!job) return null;

        return (
            <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans pb-20">
                {/* Embedded Job Detail Header */}
                <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-4 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedJob(null)} className="text-slate-300">
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                        <div className="flex items-center gap-2">
                            {isOffline && <Badge variant="destructive" className="bg-red-900/50 text-red-400 border-red-900"><WifiOff className="w-3 h-3 mr-1" /> Offline</Badge>}
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold">{job.vehicle}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-slate-800 text-slate-300 font-mono text-xs">{job.rego}</Badge>
                        <span className="text-slate-400 text-sm hidden sm:inline-block">•</span>
                        <span className="text-slate-400 text-sm font-medium truncate">{job.service}</span>
                    </div>

                    <div className="mt-6 flex gap-3">
                        <Button
                            className={`flex-1 h-14 text-base font-semibold transition-all ${job.isClockedIn ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                            onClick={(e) => handleClockIn(job.id, e)}
                        >
                            <Timer className={`w-5 h-5 mr-2 ${job.isClockedIn ? 'animate-pulse' : ''}`} />
                            {job.isClockedIn ? 'Clock Out' : 'Clock In'}
                        </Button>
                    </div>
                </header>

                <main className="flex-1 p-4 space-y-6">
                    {/* Giant Hit Area Buttons for Mobile Context */}
                    <div className="grid grid-cols-2 gap-4">
                        <Link href={`/${tenant}/dashboard/inspections/new?job=${job.id}`} className="block">
                            <Card className="bg-slate-900 border-slate-800 hover:bg-slate-800 transition-colors h-32 flex flex-col items-center justify-center text-center">
                                <ShieldAlert className="w-8 h-8 text-blue-500 mb-2" />
                                <span className="font-semibold text-slate-200">Start Inspection</span>
                            </Card>
                        </Link>
                        <Card className="bg-slate-900 border-slate-800 hover:bg-slate-800 transition-colors h-32 flex flex-col items-center justify-center text-center opacity-50 cursor-not-allowed">
                            <Wrench className="w-8 h-8 text-slate-500 mb-2" />
                            <span className="font-semibold text-slate-400">Request Parts</span>
                        </Card>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-400 text-sm uppercase tracking-wider pl-1">Service Details</h3>
                        <Card className="bg-slate-900 border-slate-800">
                            <CardContent className="p-4 space-y-4 text-slate-300">
                                <div>
                                    <span className="block text-xs text-slate-500 mb-1">Allocated Time</span>
                                    <div className="font-medium text-lg">{job.timeAllocated}</div>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-500 mb-1">Service Instructions</span>
                                    <p className="text-sm">Perform standard 10,000km mechanical logbook service. Check brake pad widths carefully as customer noted squeaking.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">

            {/* PWA App Header */}
            <header className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 p-4 shadow-md flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-inner">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">TechBay</span>
                </div>

                {/* Persistent Networking Status indicator */}
                <div className="flex items-center gap-2">
                    {hasPendingSync && !isOffline && (
                        <Badge className="bg-blue-900/50 text-blue-400 border-blue-900 pr-1 pl-2">
                            Syncing <CloudSync className="w-3 h-3 ml-1 animate-spin" />
                        </Badge>
                    )}
                    {isOffline && (
                        <Badge variant="destructive" className="bg-red-900/50 text-red-400 border-red-900">
                            Offline <WifiOff className="w-3 h-3 ml-1" />
                        </Badge>
                    )}
                    {!isOffline && !hasPendingSync && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                    )}
                </div>
            </header>

            <main className="flex-1 p-4 pb-24 overflow-auto">

                <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-1">Today&apos;s Bays</h2>
                    <p className="text-slate-400 text-sm">{format(new Date(), "EEEE, MMMM do")}</p>
                </div>

                <div className="space-y-4">
                    {jobs.map((job) => (
                        <Card
                            key={job.id}
                            className={`bg-slate-900 border-slate-800 overflow-hidden active:scale-[0.98] transition-all cursor-pointer ${job.isClockedIn ? 'ring-2 ring-emerald-500/50' : ''}`}
                            onClick={() => setSelectedJob(job.id)}
                        >
                            {job.isClockedIn && <div className="h-1 bg-emerald-500 w-full animate-pulse"></div>}
                            <CardContent className="p-0">
                                <div className="p-4 flex gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-bold text-lg text-slate-100">{job.vehicle}</h3>
                                            <Badge className="bg-slate-800 text-slate-300 font-mono text-[10px]">{job.rego}</Badge>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-4 line-clamp-1">{job.service}</p>

                                        <div className="flex items-center gap-4 text-xs font-medium">
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <Clock className="w-3.5 h-3.5" /> {job.timeAllocated}
                                            </div>
                                            {job.status === "IN_PROGRESS" && (
                                                <span className="text-emerald-400 flex items-center gap-1"><Timer className="w-3.5 h-3.5" /> Active</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center pr-2 text-slate-600">
                                        <ChevronRight className="w-6 h-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </main>

            {/* PWA iOS-style Bottom Tab Bar */}
            <nav className="fixed bottom-0 w-full bg-slate-900 border-t border-slate-800 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
                <div className="flex justify-around items-center h-16 px-2">
                    <button
                        onClick={() => setActiveTab("jobs")}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'jobs' ? 'text-blue-500' : 'text-slate-500'}`}
                    >
                        <Wrench className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Bayes</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'history' ? 'text-blue-500' : 'text-slate-500'}`}
                    >
                        <CheckCircle2 className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Completed</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 ${activeTab === 'settings' ? 'text-blue-500' : 'text-slate-500'}`}
                    >
                        <Settings className="w-6 h-6" />
                        <span className="text-[10px] font-medium">Settings</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}
