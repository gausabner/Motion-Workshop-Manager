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

/**
 * One queue per person on the phone. A workshop's phones are shared, and a tap
 * is sent under whoever is signed in when the signal returns — so a queue that
 * belonged to nobody would hand one mechanic's unsent time to the next person
 * to sign in. Each person's taps wait under their own key until they sign in
 * on this phone again.
 */
const keyFor = (owner: string) => `motion.clock.queue.v2.${owner}`;
/** The queue before it had an owner. Taken over by the first person to open the floor after the update. */
const LEGACY_KEY = "motion.clock.queue.v1";

export function loadQueue(owner: string): ClockEvent[] {
    try {
        const raw = window.localStorage.getItem(keyFor(owner));
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isClockEvent);
    } catch {
        return [];
    }
}

export function saveQueue(owner: string, events: ClockEvent[]): void {
    try {
        if (events.length === 0) window.localStorage.removeItem(keyFor(owner));
        else window.localStorage.setItem(keyFor(owner), JSON.stringify(events));
    } catch {
        // A phone with no room left still has to work; the tap is applied on screen
        // and sent if the signal is there. Losing the queue is bad, pretending we
        // saved it would be worse.
    }
    notify();
}

/**
 * Move taps kept before queues had owners into this person's queue, once. On
 * a phone with one mechanic that is exactly where they belonged; it is the
 * same behaviour the phone had before, for the last time.
 */
export function adoptUnownedQueue(owner: string): void {
    try {
        const raw = window.localStorage.getItem(LEGACY_KEY);
        if (raw === null) return;
        const parsed: unknown = JSON.parse(raw);
        const legacy = Array.isArray(parsed) ? parsed.filter(isClockEvent) : [];
        window.localStorage.removeItem(LEGACY_KEY);
        if (legacy.length > 0) saveQueue(owner, [...loadQueue(owner), ...legacy]);
    } catch {
        // Unreadable is the same as empty.
    }
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

export const queueCount = (owner: string): number => loadQueue(owner).length;

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

export function enqueue(owner: string, event: ClockEvent): ClockEvent[] {
    const next = [...loadQueue(owner), event];
    saveQueue(owner, next);
    return next;
}

/** Drop the taps the server has taken, keeping anything added while the batch was in flight. */
export function forget(owner: string, refs: string[]): ClockEvent[] {
    const done = new Set(refs);
    const next = loadQueue(owner).filter((event) => !done.has(event.ref));
    saveQueue(owner, next);
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
    // A development server serves changing code under unchanging names, which the worker's cache-first
    // shell would freeze; only a production build, whose names change with its code, is cached.
    if (process.env.NODE_ENV !== "production") {
        navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => r.unregister())).catch(() => {});
        if (typeof caches !== "undefined") caches.keys().then((keys) => keys.filter((k) => k.startsWith("motion-")).forEach((k) => caches.delete(k))).catch(() => {});
        return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unregistered worker costs the mechanic nothing but the offline shell.
    });
}

/**
 * What signing out removes from the phone: the last floor page the worker
 * kept for a dead spot, which lists the jobs, plates and departments of
 * whoever was signed in. Left behind, anyone opening the floor address on a
 * shared phone with no signal would read the previous person's day.
 *
 * The clock queues stay. They hold job references and times, not names, and
 * they are somebody's unpaid hours until that person signs in here again.
 */
export async function clearFloorPages(): Promise<void> {
    try {
        if (typeof caches === "undefined") return;
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("motion-") && key.endsWith("-pages")).map((key) => caches.delete(key)));
    } catch {
        // Nothing cached, or no access to the cache: either way there is nothing to leave behind.
    }
}
