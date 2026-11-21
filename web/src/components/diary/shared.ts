import type { JobStatus } from "@prisma/client";
import { CalendarClock, CheckCircle2, ClipboardCheck, Hourglass, Package, Wrench, type LucideIcon } from "lucide-react";
import type { Load } from "@/lib/diary/capacity";
import { JOB_STATUS_LABELS } from "@/lib/documents/types";

/** Vertical scale of the day view. 1.2px a minute makes a 30-minute slot 36px — room for a plate and a name. */
export const PX_PER_MINUTE = 1.2;

export function loadTone(load: Load, fullAt: number): { bar: string; text: string; label: string } {
    if (load.available === 0 && load.booked === 0) return { bar: "bg-slate-200", text: "text-slate-500", label: "Closed" };
    if (load.percent >= fullAt) return { bar: "bg-red-500", text: "text-red-700", label: "Full" };
    if (load.percent >= 70) return { bar: "bg-amber-500", text: "text-amber-700", label: "Busy" };
    return { bar: "bg-teal-500", text: "text-teal-700", label: "Room" };
}

const DONE = new Set<JobStatus>(["JOB_COMPLETE", "CUSTOMER_NOTIFIED", "AWAITING_FINALISE", "FINALISED"]);

/**
 * Finished work fades so the eye goes to what is still to do. The rest reads
 * by its icon and its words, not by a tint: colour alone tells nobody who
 * cannot see it which job is waiting for parts. A clash is the one red, because
 * it is wrong.
 */
export function blockTone(status: JobStatus | null, clash: boolean): string {
    const done = !!status && DONE.has(status);
    const ground = done ? "bg-slate-50 text-slate-600" : "bg-white text-slate-900";
    const edge = clash ? "border-red-700 ring-1 ring-red-700" : done ? "border-slate-200" : "border-[var(--motion-field-edge)]";
    return `${ground} ${edge}`;
}

const ICONS: Partial<Record<JobStatus, LucideIcon>> = {
    WORK_IN_PROGRESS: Wrench,
    INSPECTION_IN_PROGRESS: ClipboardCheck,
    WAITING_FOR_PARTS: Package,
    WAITING_FOR_CUSTOMER_APPROVAL: Hourglass,
};

/** What a booking's status is called and drawn as: an icon and its words, as SAP marks an object's status. */
export function blockStatus(status: JobStatus | null): { label: string; Icon: LucideIcon } {
    if (!status) return { label: "Booked", Icon: CalendarClock };
    return { label: JOB_STATUS_LABELS[status], Icon: DONE.has(status) ? CheckCircle2 : (ICONS[status] ?? CalendarClock) };
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
