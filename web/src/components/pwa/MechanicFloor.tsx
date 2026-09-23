"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Pause, Play, Wrench } from "lucide-react";
import { clockOffAction, clockOnAction } from "@/lib/time/actions";
import { hoursLabel } from "@/lib/time/clock";
import { minuteLabel } from "@/lib/diary/time";
import { enqueue, forget, isOnline, loadQueue, newRef, queueCount, registerWorker, subscribeOnline, subscribeQueue } from "@/lib/offline/client";
import { syncClockQueue } from "@/lib/offline/actions";
import { waitingLabel } from "@/lib/offline/queue";

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
    // Both live outside React: the radio, and a queue another tab can also write to.
    const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);
    const waiting = useSyncExternalStore(subscribeQueue, queueCount, () => 0);
    /**
     * `undefined` means "the server's answer stands". Anything else is a tap
     * made down here with no signal, which the screen must honour immediately —
     * a mechanic will not stand in the pit wondering whether the clock started.
     */
    const [queuedRunning, setQueuedRunning] = useState<{ startedAt: string; job: Job } | null | undefined>(undefined);

    useEffect(registerWorker, []);

    /** Hand over whatever is waiting, the moment there is a signal to hand it over on. */
    const sendQueue = useCallback(() => {
        const queue = loadQueue();
        if (queue.length === 0) return;
        start(async () => {
            try {
                const result = await syncClockQueue(tenant, queue);
                forget(queue.map((e) => e.ref));
                if (result.problems.length > 0) setError(result.problems[0].reason);
                // The server is the truth again, so stop overriding it.
                setQueuedRunning(undefined);
                router.refresh();
            } catch {
                // Still no signal. The queue stays exactly where it is.
            }
        });
    }, [tenant, router]);

    useEffect(() => {
        if (online) sendQueue();
    }, [online, sendQueue]);

    /**
     * Every tap goes through here. If the server cannot be reached — whether
     * the phone knows it is offline or only finds out when the request dies —
     * the tap is kept with the time it was made and applied on screen.
     */
    function act(key: string, run: () => Promise<{ ok: boolean; message?: string }>, fallback: () => void) {
        setBusy(key);
        setError(undefined);
        start(async () => {
            if (!navigator.onLine) {
                fallback();
                setBusy(null);
                return;
            }
            try {
                const result = await run();
                if (!result.ok) setError(result.message);
                router.refresh();
            } catch {
                fallback();
            }
            setBusy(null);
        });
    }

    function queueStart(job: Job) {
        const at = new Date().toISOString();
        enqueue({ kind: "on", ref: newRef(), at, documentId: job.id });
        setQueuedRunning({ startedAt: at, job });
    }

    function queueStop() {
        enqueue({ kind: "off", ref: newRef(), at: new Date().toISOString() });
        setQueuedRunning(null);
    }

    // What the mechanic is actually on, whether the server has heard about it yet or not.
    const onTheClock = queuedRunning === undefined ? running : queuedRunning;

    const card = (job: Job, mineToo: boolean) => {
        const isRunning = onTheClock?.job.id === job.id;
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
                        onClick={() => act(job.id, () => clockOnAction(tenant, job.id), () => queueStart(job))}
                        className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-teal-600 text-lg font-semibold text-white active:bg-teal-800 disabled:opacity-60"
                    >
                        <Play className="h-5 w-5" />{busy === job.id ? "Starting…" : onTheClock ? "Switch to this job" : "Start"}
                    </button>
                )}
            </li>
        );
    };

    return (
        <main className={`min-h-dvh bg-slate-100 ${onTheClock ? "pb-[calc(9rem+env(safe-area-inset-bottom,0px))]" : "pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"}`}>
            {/* The header runs under the notch and pads its content back out, so
                the bar is the workshop's colour rather than a black letterbox. */}
            <header className="sticky top-0 z-10 bg-slate-900 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-white">
                <div className="mx-auto flex max-w-lg items-center justify-between">
                    <p className="flex items-center gap-2 font-semibold"><Wrench className="h-5 w-5 text-teal-400" />{name}</p>
                    <p className="text-sm text-slate-300">Today {hoursLabel(minutesToday)}</p>
                </div>
            </header>

            <div className="mx-auto max-w-lg space-y-5 px-4 pt-4">
                {(!online || waiting > 0) && (
                    <p className={`flex items-start gap-2 rounded-lg px-4 py-3 text-base ${online ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-900"}`}>
                        <CloudOff className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>
                            {online ? "Catching up…" : "No signal. Your taps are being kept with the time you made them."}
                            {waiting > 0 && <span className="block text-sm">{waitingLabel(waiting)}</span>}
                        </span>
                    </p>
                )}

                {error && <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800" role="alert">{error}</p>}

                {!onTheClock && (
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

            {/* The clock is pinned to the bottom rather than sitting at the top of
                the page. A mechanic stops the clock while standing at the car,
                often one-handed and often with the job list scrolled — and in the
                old layout Stop scrolled away with everything else, so stopping
                meant scrolling back up to find it. Here it is always one thumb
                away, clear of the home indicator, and it says what you are on so
                there is no doubt which job is about to stop. */}
            {onTheClock && (
                <div className="fixed inset-x-0 bottom-0 z-20 border-t border-teal-800 bg-teal-700 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 text-white shadow-[0_-4px_16px_rgba(15,23,42,.25)]">
                    <div className="mx-auto max-w-lg">
                        <div className="flex items-baseline justify-between gap-3">
                            <p className="min-w-0 truncate text-sm">
                                {onTheClock.job.vehicle && <span className="mr-2 rounded bg-yellow-300 px-1.5 font-bold text-yellow-950">{onTheClock.job.vehicle.plate}</span>}
                                {onTheClock.job.description ?? `Job ${onTheClock.job.jobNumber ?? ""}`}
                            </p>
                            <p className="shrink-0 text-2xl font-bold tabular-nums"><Elapsed since={onTheClock.startedAt} /></p>
                        </div>
                        <button
                            type="button" disabled={pending}
                            onClick={() => act("stop", () => clockOffAction(tenant), queueStop)}
                            className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-white text-lg font-semibold text-teal-800 active:bg-teal-50 disabled:opacity-60"
                        >
                            <Pause className="h-5 w-5" />{busy === "stop" ? "Stopping…" : "Stop"}
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}
