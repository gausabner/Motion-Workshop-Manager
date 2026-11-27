"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { Toast, ToastAction, ToastClose, ToastDescription, ToastRegion, ToastTitle, createToaster } from "@ui-sdk/react/toast";
import { HelpButton } from "@/components/help/HelpButton";
import { FloorNotifications } from "@/components/pwa/FloorNotifications";
import { stopReasonAction, type StopReason } from "@/lib/time/floor-actions";
import { useRouter } from "next/navigation";
import { CalendarDays, CloudOff, Pause, Play } from "lucide-react";
import { JobSheet } from "@/components/pwa/JobSheet";
import { FloorSignOut } from "@/components/pwa/FloorSignOut";
import { JobStatusPill } from "@/components/documents/StatusPill";
import type { JobStatus } from "@prisma/client";
import { Meter, MeterIndicator, MeterLabel, MeterTrack, MeterValue } from "@ui-sdk/react/meter";
import { Schedule } from "@/components/pwa/Schedule";
import type { ScheduleMonth } from "@/lib/time/floor-sheet";
import { ACCENT_ON_DARK } from "@/components/brand/MotionLogo";
import { MotionMark } from "@/components/brand/MotionMark";
import { clockOffAction, clockOnAction, undoClockAction } from "@/lib/time/actions";
import { hoursLabel } from "@/lib/time/clock";
import { minuteLabel } from "@/lib/diary/time";
import { adoptUnownedQueue, enqueue, forget, isOnline, loadQueue, newRef, queueCount, registerWorker, subscribeOnline, subscribeQueue } from "@/lib/offline/client";
import { syncClockQueue } from "@/lib/offline/actions";
import { waitingLabel } from "@/lib/offline/queue";

type Job = {
    id: string;
    jobNumber: string | null;
    description: string | null;
    jobStatus: string | null;
    time: { minute: number; day?: string } | null;
    estimatedMinutes: number | null;
    customer: { firstName: string; lastName: string } | null;
    vehicle: { plate: string; make: string; model: string } | null;
    /** Where the vehicle is on a fleet route, if it is on one. */
    place: { name: string; purpose: string; arrived: boolean } | null;
    mechanicName?: string | null;
};

/** Statuses a card leaves unsaid: the clock or the Start button already says them. */
const QUIET_STATUS = new Set(["BOOKED_IN", "WORK_IN_PROGRESS"]);

/** Jobs that can be worked now come first; those waiting for parts sink below, in their booked order. */
const workableFirst = <T extends { jobStatus: string | null }>(jobs: T[]) =>
    [...jobs].sort((a, b) => Number(a.jobStatus === "WAITING_FOR_PARTS") - Number(b.jobStatus === "WAITING_FOR_PARTS"));

/** Why the vehicle is where it is, in the words of a card. */
const HERE_FOR: Record<string, string> = {
    INTAKE: "booked in",
    ASSESSMENT: "for assessment",
    WORK: "for work",
    QUALITY_CHECK: "for its quality check",
    RELEASE: "ready for collection",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** Every pressable thing on the floor: a press the hand can feel, through gloves. */
const PRESS = "floor-press";

/**
 * The last tap kept for want of a signal, and what was running before it, so
 * Undo can take it back off the phone. One floor screen per page, so one slot.
 */
type Held = { ref: string; before: { startedAt: string; job: Job; priorMinutes?: number } | null | undefined };
const undoSlot: { held: Held | null } = { held: null };
const keepForUndo = (held: Held) => void (undoSlot.held = held);
const takeForUndo = () => {
    const held = undoSlot.held;
    undoSlot.held = null;
    return held;
};

/** A short buzz on phones that have one, so a tap is felt as well as seen. */
function buzz() {
    try {
        navigator.vibrate?.(10);
    } catch {
        // Some browsers refuse vibration outright; the tap still happened.
    }
}

type Props = {
    tenant: string;
    /** The signed-in person's membership. Their clock taps wait on this phone under it, apart from anyone else's. */
    who: string;
    name: string;
    minutesToday: number;
    running: { startedAt: string; job: Job; priorMinutes?: number } | null;
    mine: Job[];
    others: Job[];
    /** This month's booked jobs, for the schedule. */
    schedule: ScheduleMonth;
    /** Notifications not yet opened, for the bell. */
    unread: number;
    /** The mechanic's day and week, for the Today strip. */
    day: { shiftMinutes: number | null; jobsWorked: number; waitingForParts: number; weekMinutes: number; next: { jobNumber: string | null; day: string; minute: number } | null };
};

/** The time, refreshed often enough for minutes; the clock bar's seconds keep their own ticker. */
function useMinuteNow() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 20_000);
        return () => clearInterval(timer);
    }, []);
    return now;
}

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
export function MechanicFloor({ tenant, who, name, minutesToday, running, mine, others, schedule, day, unread }: Props) {
    const [toaster] = useState(() => createToaster({ duration: 10_000 }));
    useEffect(() => () => toaster.dismiss(), [toaster]);
    // The job just stopped, while the mechanic may say why.
    const [stopped, setStopped] = useState<{ id: string; jobNumber: string | null } | null>(null);
    const now = useMinuteNow();
    const [mountedAt] = useState(() => Date.now());
    const [sheet, setSheet] = useState<string | null>(null);
    const [scheduleOpen, setScheduleOpen] = useState(false);
    const router = useRouter();
    const [pending, start] = useTransition();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string>();
    // Both live outside React: the radio, and a queue another tab can also write to.
    const online = useSyncExternalStore(subscribeOnline, isOnline, () => true);
    const waiting = useSyncExternalStore(subscribeQueue, () => queueCount(who), () => 0);
    /**
     * `undefined` means "the server's answer stands". Anything else is a tap
     * made down here with no signal, which the screen must honour immediately —
     * a mechanic will not stand in the pit wondering whether the clock started.
     */
    const [queuedRunning, setQueuedRunning] = useState<Props["running"] | undefined>(undefined);

    useEffect(() => {
        adoptUnownedQueue(who);
        registerWorker();
    }, [who]);

    /** Hand over whatever is waiting, the moment there is a signal to hand it over on. */
    const sendQueue = useCallback(() => {
        const queue = loadQueue(who);
        if (queue.length === 0) return;
        start(async () => {
            try {
                const result = await syncClockQueue(tenant, queue);
                forget(who, queue.map((e) => e.ref));
                if (result.problems.length > 0) setError(result.problems[0].reason);
                // The server is the truth again, so stop overriding it.
                setQueuedRunning(undefined);
                router.refresh();
            } catch {
                // Still no signal. The queue stays exactly where it is.
            }
        });
    }, [tenant, who, router]);

    useEffect(() => {
        if (online) sendQueue();
    }, [online, sendQueue]);

    /**
     * Every tap goes through here. If the server cannot be reached — whether
     * the phone knows it is offline or only finds out when the request dies —
     * the tap is kept with the time it was made and applied on screen.
     */
    function act(key: string, run: () => Promise<{ ok: boolean; message?: string }>, fallback: () => void, after?: (queued: boolean) => void) {
        buzz();
        setBusy(key);
        setError(undefined);
        start(async () => {
            if (!navigator.onLine) {
                fallback();
                after?.(true);
                setBusy(null);
                return;
            }
            try {
                const result = await run();
                if (!result.ok) setError(result.message);
                else after?.(false);
                router.refresh();
            } catch {
                fallback();
                after?.(true);
            }
            setBusy(null);
        });
    }

    function queueStart(job: Job) {
        const at = new Date().toISOString();
        const ref = newRef();
        keepForUndo({ ref, before: queuedRunning });
        enqueue(who, { kind: "on", ref, at, documentId: job.id });
        setQueuedRunning({ startedAt: at, job });
    }

    function queueStop() {
        const ref = newRef();
        keepForUndo({ ref, before: queuedRunning });
        enqueue(who, { kind: "off", ref, at: new Date().toISOString() });
        setQueuedRunning(null);
    }

    /** Take back the last Stop or Switch: from the queue when it never left the phone, otherwise on the server. */
    function undo() {
        buzz();
        setStopped(null);
        const kept = takeForUndo();
        if (kept && loadQueue(who).some((e) => e.ref === kept.ref)) {
            forget(who, [kept.ref]);
            setQueuedRunning(kept.before);
            return;
        }
        start(async () => {
            try {
                const result = await undoClockAction(tenant);
                if (!result.ok) setError(result.message);
                router.refresh();
            } catch {
                setError("Undo needs a signal. Start the job again instead.");
            }
        });
    }

    // The reasons are asked for only when the mechanic taps "Why?" on the stop's toast; a lunch break needs no form.
    function stop() {
        const was = onTheClock?.job ?? null;
        act("stop", () => clockOffAction(tenant), queueStop, (queued) => {
            // The job number goes on its own line, so a narrow toast never breaks it at its hyphen.
            toaster("Clock stopped", {
                description: was?.jobNumber ?? undefined,
                action: { label: "Undo", onAction: undo },
                ...(!queued && was ? { cancel: { label: "Why?", onCancel: () => setStopped({ id: was.id, jobNumber: was.jobNumber }) } } : {}),
            });
        });
    }

    function begin(job: Job) {
        const switching = !!onTheClock;
        setStopped(null);
        act(job.id, () => clockOnAction(tenant, job.id), () => queueStart(job), () => {
            if (switching) toaster("Switched jobs", { description: job.jobNumber ? `Now on ${job.jobNumber}` : undefined, action: { label: "Undo", onAction: undo } });
        });
    }

    function because(reason: StopReason) {
        const job = stopped;
        setStopped(null);
        if (!job) return;
        buzz();
        start(async () => {
            try {
                const result = await stopReasonAction(tenant, job.id, reason);
                if (!result.ok) setError(result.message);
                else toaster(result.message, { duration: 5_000 });
                if (reason === "PARTS") router.refresh();
            } catch {
                setError("That needs a signal. Tell the foreman yourself.");
            }
        });
    }

    // What the mechanic is actually on, whether the server has heard about it yet or not.
    const onTheClock = queuedRunning === undefined ? running : queuedRunning;
    // The bar keeps showing the job it was on while it slides away.
    const [lastClock, setLastClock] = useState(onTheClock);
    if (onTheClock && onTheClock !== lastClock) setLastClock(onTheClock);
    const bar = onTheClock ?? lastClock;
    // Which job's Start is still waiting for a signal, and since when. Read again whenever the queue changes.
    const heldStart = useMemo(() => {
        const held = new Map<string, string>();
        if (waiting > 0) for (const e of loadQueue(who)) if (e.kind === "on") held.set(e.documentId, e.at);
        return held;
    }, [waiting, who]);

    const card = (job: Job, mineToo: boolean) => {
        const isRunning = onTheClock?.job.id === job.id;
        const vehicle = job.vehicle ? `${job.vehicle.make} ${job.vehicle.model}`.trim() : null;
        const title = job.description ?? vehicle ?? `Job ${job.jobNumber ?? ""}`;
        const who = job.customer ? `${job.customer.firstName} ${job.customer.lastName}`.trim() : null;
        const held = heldStart.get(job.id);
        return (
            <li key={job.id} className={`rounded-sm border bg-white p-4 transition-colors duration-150 ${isRunning ? "border-teal-700" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                    <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                        {job.jobNumber && <span className="font-semibold text-slate-900">{job.jobNumber}</span>}
                        {job.vehicle && <span className="rounded-sm bg-yellow-100 px-1.5 font-bold text-yellow-900">{job.vehicle.plate}</span>}
                        {!mineToo && job.mechanicName && <span className="text-slate-600">· {job.mechanicName}</span>}
                    </p>
                    {isRunning ? (
                        <span className="shrink-0 text-sm font-medium text-teal-700">On the clock</span>
                    ) : job.jobStatus && !QUIET_STATUS.has(job.jobStatus) ? (
                        <JobStatusPill status={job.jobStatus as JobStatus} className="shrink-0" />
                    ) : (
                        // A job booked for another day says which day, so 09:00 is never read as this morning.
                        job.time && <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{job.time.day && job.time.day !== schedule.today ? `${dayName(job.time.day)} ` : ""}{minuteLabel(job.time.minute)}</span>
                    )}
                </div>
                <button type="button" onClick={() => setSheet(job.id)} className="floor-press mt-1 block w-full text-left" aria-label={`Open ${job.jobNumber ?? title}: ${title}`}>
                    <span className="block text-base font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4">{title}</span>
                    <span className="block text-sm text-slate-600">
                        {[job.description ? vehicle : null, who, job.estimatedMinutes ? `about ${hoursLabel(job.estimatedMinutes)}` : null].filter(Boolean).join(" · ") || "\u00a0"}
                    </span>
                </button>
                {job.place && (
                    <p className="mt-1 text-sm text-slate-700">
                        {job.place.arrived ? `At ${job.place.name}, ${HERE_FOR[job.place.purpose] ?? "on its route"}` : `On its way to ${job.place.name}`}
                    </p>
                )}
                {held && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />Not sent yet · started {time(held)}
                    </p>
                )}
                {!isRunning && (
                    <button
                        type="button" disabled={pending}
                        onClick={() => begin(job)}
                        className={`${PRESS} mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-sm bg-teal-700 text-lg font-semibold text-white active:bg-teal-800 disabled:opacity-60`}
                    >
                        <Play className="h-5 w-5" aria-hidden="true" />{busy === job.id ? "Starting…" : onTheClock ? "Switch to this job" : "Start"}
                        <span className="sr-only">: {[job.jobNumber, job.vehicle?.plate, title].filter(Boolean).join(", ")}</span>
                    </button>
                )}
            </li>
        );
    };

    // A job on today's list can be started from its sheet; one booked for another day can only be read.
    const startable = (id: string) => {
        const job = [...mine, ...others].find((j) => j.id === id);
        if (!job || onTheClock?.job.id === id) return null;
        return () => {
            setSheet(null);
            begin(job);
        };
    };

    return (
        <main className={`min-h-dvh bg-slate-50 ${onTheClock || stopped ? "pb-[calc(9rem+env(safe-area-inset-bottom,0px))]" : "pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]"}`}>
            {/* The header runs under the notch and pads its content back out, so
                the bar is the workshop's colour rather than a black letterbox. */}
            <header className="sticky top-0 z-10 bg-slate-900 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] text-white">
                <div className="mx-auto flex max-w-lg items-center justify-between">
                    {/* The mark rather than a generic spanner. This screen is
                        the installed app, and the icon the mechanic just
                        tapped on their home screen is this exact shape — the
                        header should answer it. It draws in once, on open,
                        which the floor app affords because it is one screen
                        opened at the start of a shift rather than chrome seen
                        on every navigation. */}
                    <h1 className="flex items-center gap-2 text-base font-semibold">
                        <MotionMark className="h-5 w-5 shrink-0" accent={ACCENT_ON_DARK} animated />
                        {name}
                    </h1>
                    <div className="flex items-center gap-3">
                        <HelpButton className="floor-press relative grid h-10 w-10 place-items-center rounded-sm border border-slate-600 text-white active:bg-slate-800" />
                        <FloorNotifications tenant={tenant} unread={unread} onOpenJob={setSheet} />
                        <button
                            type="button"
                            onClick={() => setScheduleOpen(true)}
                            className="floor-press inline-flex h-10 items-center gap-1.5 rounded-sm border border-slate-600 px-3 text-sm font-medium text-white active:bg-slate-800"
                        >
                            <CalendarDays className="h-4 w-4" aria-hidden="true" />Schedule
                        </button>
                    </div>
                </div>
            </header>
            <TodayStrip
                today={schedule.today}
                minutes={minutesToday + (onTheClock ? Math.max(0, Math.floor((now - Math.max(mountedAt, new Date(onTheClock.startedAt).getTime())) / 60_000)) : 0)}
                day={day}
            />

            <div className="mx-auto max-w-lg space-y-5 px-4 pt-4">
                {/* Always in the page, so losing and finding the signal is announced, not only drawn. */}
                <div role="status" className="empty:absolute">
                    {(!online || waiting > 0) && (
                        <p className={`flex items-start gap-2 rounded-sm border px-4 py-3 text-base ${online ? "border-slate-200 bg-slate-50 text-slate-700" : "border-slate-300 bg-white text-slate-900"}`}>
                            <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                            <span>
                                {online ? "Catching up…" : "No signal. Your taps are being kept with the time you made them."}
                                {waiting > 0 && <span className="block text-sm">{waitingLabel(waiting)}</span>}
                            </span>
                        </p>
                    )}
                </div>

                {error && <p className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800" role="alert">{error}</p>}


                <section className="space-y-2">
                    <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">My jobs</h2>
                    {mine.length ? <ul className="space-y-3">{workableFirst(mine).map((j) => card(j, true))}</ul> : <p className="px-1 text-base text-slate-500">No jobs are assigned to you today.</p>}
                </section>

                {others.length > 0 && (
                    <section className="space-y-2">
                        <h2 className="px-1 text-sm font-semibold uppercase tracking-wider text-slate-500">Other jobs today</h2>
                        <ul className="space-y-3">{others.map((j) => card(j, false))}</ul>
                    </section>
                )}

                <FloorSignOut name={name} running={onTheClock ? (onTheClock.job.jobNumber ?? "this job") : null} waiting={waiting} />
            </div>

            {/* The clock is pinned to the bottom rather than sitting at the top of
                the page. A mechanic stops the clock while standing at the car,
                often one-handed and often with the job list scrolled — and in the
                old layout Stop scrolled away with everything else, so stopping
                meant scrolling back up to find it. Here it is always one thumb
                away, clear of the home indicator, and it says what you are on so
                there is no doubt which job is about to stop. */}
            {bar && (
                <div
                    data-open={onTheClock ? "true" : "false"}
                    aria-hidden={!onTheClock}
                    inert={!onTheClock}
                    className="floor-clock fixed inset-x-0 bottom-0 z-20 border-t border-teal-800 bg-teal-700 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 text-white"
                >
                    <div className="mx-auto max-w-lg">
                        <div className="flex items-baseline justify-between gap-3">
                            <button type="button" onClick={() => setSheet(bar.job.id)} aria-label={`Open ${bar.job.jobNumber ?? "the running job"}`} className="floor-press -my-1 min-w-0 truncate rounded-sm py-1 text-left text-sm underline decoration-teal-400 underline-offset-4">
                                {bar.job.jobNumber && <span className="mr-2 font-semibold">{bar.job.jobNumber}</span>}
                                {bar.job.vehicle && <span className="mr-2 rounded-sm bg-yellow-300 px-1.5 font-bold text-yellow-950 no-underline">{bar.job.vehicle.plate}</span>}
                                {bar.job.description ?? (bar.job.vehicle ? `${bar.job.vehicle.make} ${bar.job.vehicle.model}` : "")}
                            </button>
                            <p className="shrink-0 text-2xl font-bold tabular-nums"><Elapsed since={bar.startedAt} /></p>
                        </div>
                        {bar.job.estimatedMinutes ? <EstimateMeter estimate={bar.job.estimatedMinutes} minutes={(bar.priorMinutes ?? 0) + Math.max(0, Math.floor((now - new Date(bar.startedAt).getTime()) / 60_000))} /> : null}
                        <button
                            type="button" disabled={pending}
                            onClick={stop}
                            className={`${PRESS} mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-sm bg-white text-lg font-semibold text-teal-800 active:bg-teal-50 disabled:opacity-60`}
                        >
                            <Pause className="h-5 w-5" aria-hidden="true" />{busy === "stop" ? "Stopping…" : "Stop"}
                            {bar.job.jobNumber && <span className="sr-only">: {bar.job.jobNumber}</span>}
                        </button>
                    </div>
                </div>
            )}
            {stopped && !onTheClock && (
                <section aria-labelledby="stop-why" className="floor-reasons fixed inset-x-0 bottom-0 z-20 border-t border-slate-300 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-4px_16px_rgba(15,23,42,.12)]">
                    <div className="mx-auto max-w-lg">
                        <div className="flex items-baseline justify-between gap-3">
                            <h2 id="stop-why" className="text-base font-semibold text-slate-900">
                                Why did you stop{stopped.jobNumber ? ` ${stopped.jobNumber}` : ""}? <span className="text-sm font-normal text-slate-600">Optional</span>
                            </h2>
                            <button type="button" onClick={() => setStopped(null)} className="floor-press -mr-2 h-11 rounded-sm px-2 text-sm font-medium text-slate-700 active:bg-slate-100">Skip</button>
                        </div>
                        <div className="mt-2 grid gap-2">
                            {([
                                { value: "PARTS", label: "Waiting for parts", hint: "the job shows it" },
                                { value: "BREAK", label: "Break or end of shift", hint: "" },
                                { value: "DONE", label: "My part is done", hint: "the foreman is told" },
                            ] as const).map((r) => (
                                <button key={r.value} type="button" onClick={() => because(r.value)} className="floor-press flex h-14 items-center justify-between gap-3 rounded-sm border border-slate-300 px-4 text-left text-base font-medium text-slate-900 active:bg-slate-50">
                                    {r.label}
                                    {r.hint && <span className="text-[13px] font-normal text-slate-600">{r.hint}</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            )}
            <ToastRegion toaster={toaster} side="top" align="center" className="floor-toasts">
                {(item) => (
                    <Toast className="floor-toast flex items-center justify-between gap-2 rounded-sm bg-slate-900 py-2 pl-4 pr-2 text-white shadow-[0_10px_25px_rgba(15,23,42,.25)]">
                        <span className="min-w-0">
                            <ToastTitle className="block text-base font-medium" />
                            <ToastDescription className="block text-sm text-slate-300" />
                        </span>
                        <span className="flex shrink-0 items-center">
                            {item.cancel && (
                                <ToastClose action={item.cancel.onCancel} aria-label="Say why you stopped" className="floor-press h-11 rounded-sm px-3 text-base font-medium text-white underline decoration-slate-500 underline-offset-4 active:bg-slate-800">
                                    {item.cancel.label}
                                </ToastClose>
                            )}
                            <ToastAction className="floor-press h-11 rounded-sm px-3 text-base font-semibold text-[var(--motion-accent-on-dark)] active:bg-slate-800" />
                        </span>
                    </Toast>
                )}
            </ToastRegion>
            <JobSheet
                tenant={tenant}
                jobId={sheet}
                onClose={() => setSheet(null)}
                start={sheet ? startable(sheet) : null}
                startLabel={onTheClock ? "Switch to this job" : "Start"}
                onTheClock={!!sheet && onTheClock?.job.id === sheet}
                stop={() => { setSheet(null); stop(); }}
                onChanged={() => router.refresh()}
            />
            <Schedule tenant={tenant} initial={schedule} open={scheduleOpen} onOpenChange={setScheduleOpen} startable={startable} startLabel={onTheClock ? "Switch to this job" : "Start"} runningId={onTheClock?.job.id ?? null} />
        </main>
    );
}

/** This job's time against its estimate, on the clock bar. Past the estimate the bar stays full and the words say by how much. */
function EstimateMeter({ minutes, estimate }: { minutes: number; estimate: number }) {
    const over = minutes - estimate;
    return (
        <Meter value={minutes} min={0} max={estimate} format={(v: number) => `${hoursLabel(v)} of ${hoursLabel(estimate)}`} className="mt-1.5 block">
            <MeterLabel className="sr-only">This job against its estimate</MeterLabel>
            <MeterTrack className="h-1.5 overflow-hidden rounded-sm bg-teal-900/60">
                <MeterIndicator className="floor-meter h-full bg-white" />
            </MeterTrack>
            <p className="mt-1 text-[13px] text-teal-50">
                <MeterValue />
                {over > 0 ? ` · ${hoursLabel(over)} over` : " estimated"}
            </p>
        </Meter>
    );
}

const dayName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });

/**
 * The mechanic's own numbers, under the header: today on the clock against
 * the shift, the jobs worked and how many wait for parts, and the next booked
 * job. None of it compares one mechanic with another.
 */
function TodayStrip({ today, minutes, day }: { today: string; minutes: number; day: Props["day"] }) {
    const cell = "min-w-0 px-3 py-2.5";
    const label = "text-xs font-semibold uppercase tracking-wider text-slate-600";
    return (
        <div className="border-b border-slate-200 bg-white">
        <dl className="mx-auto grid max-w-lg grid-cols-3 divide-x divide-slate-200">
            <div className={cell}>
                {day.shiftMinutes ? (
                    <Meter value={minutes} min={0} max={day.shiftMinutes} format={(v: number) => `${hoursLabel(v)} of ${hoursLabel(day.shiftMinutes!)}`}>
                        <dt><MeterLabel className={label}>Today</MeterLabel></dt>
                        <dd>
                            <span className="block text-base font-semibold tabular-nums text-slate-900">{hoursLabel(minutes)}</span>
                            <MeterTrack className="mt-1 h-1 overflow-hidden rounded-sm bg-slate-200">
                                <MeterIndicator className="floor-meter h-full bg-teal-700" />
                            </MeterTrack>
                            <span className="mt-0.5 block text-[13px] text-slate-600">of {hoursLabel(day.shiftMinutes)}</span>
                        </dd>
                    </Meter>
                ) : (
                    <>
                        <dt className={label}>Today</dt>
                        <dd><span className="block text-base font-semibold tabular-nums text-slate-900">{hoursLabel(minutes)}</span><span className="block text-[13px] text-slate-600">Not a working day</span></dd>
                    </>
                )}
            </div>
            <div className={cell}>
                <dt className={label}>Jobs</dt>
                <dd>
                    <span className="block text-base font-semibold tabular-nums text-slate-900">{day.jobsWorked}</span>
                    <span className="block text-[13px] leading-snug text-slate-600">{day.waitingForParts ? `${day.waitingForParts} waiting for parts` : "worked today"}</span>
                </dd>
            </div>
            <div className={cell}>
                <dt className={label}>Next</dt>
                <dd>
                    {day.next ? (
                        <>
                            <span className="block text-base font-semibold tabular-nums text-slate-900">{day.next.day === today ? minuteLabel(day.next.minute) : `${dayName(day.next.day)} ${minuteLabel(day.next.minute)}`}</span>
                            <span className="block truncate text-[13px] text-slate-600">{day.next.jobNumber ?? "Booked job"}</span>
                        </>
                    ) : (
                        <>
                            <span className="block text-base font-semibold text-slate-900">None</span>
                            <span className="block text-[13px] text-slate-600">booked ahead</span>
                        </>
                    )}
                </dd>
            </div>
            <div className="col-span-3 border-t border-slate-100 px-3 py-1.5 text-[13px] text-slate-600">
                <dt className="inline">This week</dt> <dd className="inline font-medium tabular-nums text-slate-900">{hoursLabel(day.weekMinutes)}</dd>
            </div>
        </dl>
        </div>
    );
}
