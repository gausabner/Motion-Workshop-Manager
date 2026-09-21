import type { JobStatus } from "@prisma/client";
import type { Load } from "@/lib/diary/capacity";

/** Vertical scale of the day view. 1.2px a minute makes a 30-minute slot 36px — room for a plate and a name. */
export const PX_PER_MINUTE = 1.2;

export function loadTone(load: Load, fullAt: number): { bar: string; text: string; label: string } {
    if (load.available === 0 && load.booked === 0) return { bar: "bg-slate-200", text: "text-slate-400", label: "Closed" };
    if (load.percent >= fullAt) return { bar: "bg-red-500", text: "text-red-700", label: "Full" };
    if (load.percent >= 70) return { bar: "bg-amber-500", text: "text-amber-700", label: "Busy" };
    return { bar: "bg-teal-500", text: "text-teal-700", label: "Room" };
}

/** Finished work fades so the eye goes to what is still to do. */
export function blockTone(status: JobStatus | null, clash: boolean): string {
    const done = status === "JOB_COMPLETE" || status === "CUSTOMER_NOTIFIED" || status === "AWAITING_FINALISE" || status === "FINALISED";
    const base = done
        ? "bg-slate-100 border-slate-300 text-slate-500"
        : status === "WORK_IN_PROGRESS" || status === "INSPECTION_IN_PROGRESS"
          ? "bg-blue-50 border-blue-400 text-blue-900"
          : status === "WAITING_FOR_PARTS" || status === "WAITING_FOR_CUSTOMER_APPROVAL"
            ? "bg-amber-50 border-amber-400 text-amber-900"
            : "bg-teal-50 border-teal-500 text-teal-900";
    return clash ? `${base} ring-2 ring-red-500 ring-offset-1` : base;
}

export const WEEKDAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function dayHeading(day: string, style: "long" | "short" = "long"): string {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        weekday: style === "long" ? "long" : "short",
        day: "numeric",
        month: style === "long" ? "long" : "short",
    });
}

/**
 * Keep receiving a pointer's moves once it leaves the element. Can throw when
 * the pointer is already gone (released between events, or a stylus lifted),
 * and a drag that fails to capture should still work — just less smoothly.
 */
export function capture(e: { currentTarget: EventTarget; pointerId: number }): void {
    try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
        // Not fatal: moves over the element itself still arrive.
    }
}
