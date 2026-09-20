import type { ClockEvent } from "./queue";

/**
 * The mechanic's side of the queue: what the phone keeps when it cannot reach
 * the server.
 *
 * `localStorage` rather than IndexedDB, on purpose. The queue is a handful of
 * small records that must survive the app being closed and the phone being
 * locked, and every write has to be synchronous — a mechanic taps Start and
 * puts the phone in their overall pocket, and the page may never get another
 * tick of JavaScript before it is frozen.
 *
 * Every read is defensive: private browsing, a cleared site, a full disk and a
 * corrupted value all present as "no queue", which is the right answer.
 */

const KEY = "motion.clock.queue.v1";

export function loadQueue(): ClockEvent[] {
    try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isClockEvent);
    } catch {
        return [];
    }
}

export function saveQueue(events: ClockEvent[]): void {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(events));
    } catch {
        // A phone with no room left still has to work; the tap is applied on screen
        // and sent if the signal is there. Losing the queue is bad, pretending we
        // saved it would be worse.
    }
    notify();
}

/**
 * The queue and the signal are both things that change outside React, so the
 * screen subscribes to them rather than copying them into state inside an
 * effect. Snapshots are numbers and booleans, which keeps them stable between
 * reads.
 */
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeQueue(listener: () => void): () => void {
    listeners.add(listener);
    // Another tab of the same app — two phones is normal, two tabs happens.
    window.addEventListener("storage", listener);
    return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", listener);
    };
}

export const queueCount = (): number => loadQueue().length;

export function subscribeOnline(listener: () => void): () => void {
    window.addEventListener("online", listener);
    window.addEventListener("offline", listener);
    return () => {
        window.removeEventListener("online", listener);
        window.removeEventListener("offline", listener);
    };
}

/** On the server there is no signal to speak of, so the page renders as if all is well. */
export const isOnline = (): boolean => navigator.onLine;

export function enqueue(event: ClockEvent): ClockEvent[] {
    const next = [...loadQueue(), event];
    saveQueue(next);
    return next;
}

/** Drop the taps the server has taken, keeping anything added while the batch was in flight. */
export function forget(refs: string[]): ClockEvent[] {
    const done = new Set(refs);
    const next = loadQueue().filter((event) => !done.has(event.ref));
    saveQueue(next);
    return next;
}

function isClockEvent(value: unknown): value is ClockEvent {
    if (typeof value !== "object" || value === null) return false;
    const event = value as Record<string, unknown>;
    if (typeof event.ref !== "string" || typeof event.at !== "string") return false;
    if (event.kind === "on") return typeof event.documentId === "string";
    return event.kind === "off";
}

/** A reference the phone makes up, so the same tap sent twice is recognised. */
export function newRef(): string {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
}

/**
 * Registered from the floor app rather than the root layout: the worker exists
 * to keep one screen working in a dead spot, and a mechanic installing the app
 * is what should bring it into being.
 */
export function registerWorker(): void {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unregistered worker costs the mechanic nothing but the offline shell.
    });
}
