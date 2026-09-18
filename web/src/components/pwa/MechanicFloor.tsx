"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Wrench } from "lucide-react";
import { clockOffAction, clockOnAction } from "@/lib/time/actions";
import { hoursLabel } from "@/lib/time/clock";
import { minuteLabel } from "@/lib/diary/time";

type Job = {
    id: string;
    jobNumber: string | null;
    description: string | null;
    jobStatus: string | null;
    time: { minute: number } | null;
    estimatedMinutes: number | null;
    customer: { firstName: string; lastName: string } | null;
    vehicle: { plate: string; make: string; model: string } | null;
    mechanicName?: string | null;
};

type Props = {
    tenant: string;
    name: string;
    minutesToday: number;
    running: { startedAt: string; job: Job } | null;
    mine: Job[];
    others: Job[];
};

/** A running clock, counted on the phone so it moves without asking the server. */
function Elapsed({ since }: { since: string }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);
    const seconds = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    // The server renders this a moment before the phone does, so the seconds always
    // differ on first paint. That difference is the point of a clock, not a bug —
    // React's documented escape hatch for exactly this is suppressHydrationWarning.
    return <span className="tabular-nums" suppressHydrationWarning>{h}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}

/**
 * The floor app (R4): what a mechanic sees on their phone with oily hands.
 * One big button per job. Starting a job stops the one that was running,
 * because walking to the next car is what that means.
 */
export function MechanicFloor({ tenant, name, minutesToday, running, mine, others }: Props) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string>();

    function act(key: string, run: () => Promise<{ ok: boolean; message?: string }>) {
        setBusy(key);
        setError(undefined);
        start(async () => {
            const result = await run();
            if (!result.ok) setError(result.message);
            setBusy(null);
            router.refresh();
        });
    }

    const card = (job: Job, mineToo: boolean) => {
        const isRunning = running?.job.id === job.id;
        return (
            <li key={job.id} className={`rounded-xl border bg-white p-4 shadow-sm ${isRunning ? "border-teal-500 ring-2 ring-teal-500" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            {job.time && <span className="font-semibold tabular-nums text-slate-700">{minuteLabel(job.time.minute)}</span>}
                            {job.vehicle && <span className="rounded bg-yellow-100 px-1.5 font-bold text-yellow-900">{job.vehicle.plate}</span>}
                            {!mineToo && job.mechanicName && <span>· {job.mechanicName}</span>}
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-800">{job.description ?? (job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}` : `Job ${job.jobNumber ?? ""}`)}</p>
                        <p className="text-sm text-slate-500">
                            {job.customer ? `${job.customer.firstName} ${job.customer.lastName}` : "No customer"}
                            {job.estimatedMinutes ? ` · about ${hoursLabel(job.estimatedMinutes)}` : ""}
                        </p>
                    </div>
                </div>
                {!isRunning && (
                    <button
                        type="button" disabled={pending}
                        onClick={() => act(job.id, () => clockOnAction(tenant, job.id))}
                        className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 text-lg font-semibold text-white active:bg-teal-800 disabled:opacity-60"
                    >
                        <Play className="h-5 w-5" />{busy === job.id ? "Starting…" : running ? "Switch to this job" : "Start"}
                    </button>
                )}
            </li>
        );
    };

    return (
        <main className="min-h-screen bg-slate-100 pb-10">
            <header className="sticky top-0 z-10 bg-slate-900 px-4 py-3 text-white">
                <div className="mx-auto flex max-w-lg items-center justify-between">
                    <p className="flex items-center gap-2 font-semibold"><Wrench className="h-5 w-5 text-teal-400" />{name}</p>
                    <p className="text-sm text-slate-300">Today {hoursLabel(minutesToday)}</p>
                </div>
            </header>

            <div className="mx-auto max-w-lg space-y-5 px-4 pt-4">
                {error && <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800" role="alert">{error}</p>}

                {running ? (
                    <section className="rounded-xl bg-teal-700 p-5 text-white shadow">
                        <p className="text-sm uppercase tracking-wider text-teal-100">On the clock</p>
                        <p className="mt-1 text-lg font-semibold">
                            {running.job.vehicle && <span className="mr-2 rounded bg-yellow-300 px-1.5 text-yellow-950">{running.job.vehicle.plate}</span>}
                            {running.job.description ?? `Job ${running.job.jobNumber ?? ""}`}
                        </p>
                        <p className="mt-2 text-5xl font-bold"><Elapsed since={running.startedAt} /></p>
                        <button
                            type="button" disabled={pending}
                            onClick={() => act("stop", () => clockOffAction(tenant))}
                            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-white text-lg font-semibold text-teal-800 active:bg-teal-50 disabled:opacity-60"
                        >
                            <Pause className="h-5 w-5" />{busy === "stop" ? "Stopping…" : "Stop"}
                        </button>
                    </section>
                ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-base text-slate-500">Not on the clock. Tap Start on a job.</p>
                )}

                <section className="space-y-2">
                    <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">My jobs</h2>
                    {mine.length ? <ul className="space-y-3">{mine.map((j) => card(j, true))}</ul> : <p className="px-1 text-base text-slate-500">Nothing assigned to you today.</p>}
                </section>

                {others.length > 0 && (
                    <section className="space-y-2">
                        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">Other jobs today</h2>
                        <ul className="space-y-3">{others.map((j) => card(j, false))}</ul>
                    </section>
                )}
            </div>
        </main>
    );
}
