"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DiarySettings } from "@/lib/diary/capacity";
import { minuteLabel } from "@/lib/diary/time";
import { moveBookingAction } from "@/lib/diary/actions";
import type { DiaryBooking, DiaryDay, DiaryMechanic } from "@/lib/diary/queries";
import { capture, blockTone, dayHeading, loadTone } from "@/components/diary/shared";

type Props = {
    tenant: string;
    days: DiaryDay[];
    mechanics: DiaryMechanic[];
    settings: DiarySettings;
    today: string;
    hrefForDay: (day: string) => string;
    canEdit: boolean;
};

/**
 * The week at a glance: how full each day is, and what is in it. A booking
 * dragged to another day keeps its time and its mechanic — the usual reason to
 * move a job across days is that the car did not arrive.
 */
export function WeekView({ tenant, days, mechanics, settings, today, hrefForDay, canEdit }: Props) {
    const router = useRouter();
    const [bookings, setBookings] = useState<DiaryBooking[]>(days.flatMap((d) => d.bookings));
    const [drag, setDrag] = useState<{ id: string; x: number; y: number; moved: boolean; day: string | null } | null>(null);
    const [error, setError] = useState<string>();
    const [, start] = useTransition();
    const columns = useRef(new Map<string, HTMLDivElement>());
    const initials = new Map(mechanics.map((m) => [m.id, m.initials]));

    function dayAt(clientX: number): string | null {
        for (const [day, el] of columns.current) {
            const rect = el.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right) return day;
        }
        return null;
    }

    function drop(b: DiaryBooking, day: string) {
        if (day === b.day) return;
        const before = bookings;
        setBookings(before.map((x) => (x.id === b.id ? { ...x, day } : x)));
        setError(undefined);
        start(async () => {
            const result = await moveBookingAction(tenant, { documentId: b.id, day, minute: b.start, mechanicId: b.mechanicId });
            if (!result.ok) {
                setBookings(before);
                setError(result.message);
            } else router.refresh();
        });
    }

    return (
        <div className="space-y-2">
            {error && <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error} — it has been put back.</p>}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {days.map((d) => {
                    const tone = loadTone(d.load, settings.fullAtPercent);
                    const mine = bookings.filter((b) => b.day === d.day).sort((a, b) => a.start - b.start);
                    const hovered = drag?.moved && drag.day === d.day;
                    return (
                        <div
                            key={d.day}
                            ref={(el) => { if (el) columns.current.set(d.day, el); else columns.current.delete(d.day); }}
                            className={`min-h-[220px] rounded-sm border bg-white ${d.day === today ? "border-teal-500" : "border-slate-200"} ${hovered ? "ring-2 ring-teal-500" : ""} ${!d.open ? "bg-slate-50" : ""}`}
                        >
                            <Link href={hrefForDay(d.day)} className="block border-b border-slate-100 px-2 py-1.5 hover:bg-slate-50">
                                <p className={`text-xs font-semibold ${d.day === today ? "text-teal-700" : "text-slate-700"}`}>{dayHeading(d.day, "short")}</p>
                                <div className="mt-1 flex items-center gap-1.5">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                                        <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(d.load.percent, 100)}%` }} />
                                    </div>
                                    <span className={`text-[10px] tabular-nums ${tone.text}`}>{d.open ? `${d.load.percent}%` : "Closed"}</span>
                                </div>
                            </Link>
                            <ul className="space-y-1 p-1.5">
                                {mine.map((b) => (
                                    <li
                                        key={b.id}
                                        onPointerDown={(e) => {
                                            if (!canEdit || e.button !== 0) return;
                                            capture(e);
                                            setDrag({ id: b.id, x: e.clientX, y: e.clientY, moved: false, day: b.day });
                                        }}
                                        onPointerMove={(e) => {
                                            if (drag?.id !== b.id) return;
                                            const moved = drag.moved || Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 5;
                                            setDrag({ ...drag, moved, day: moved ? dayAt(e.clientX) : drag.day });
                                        }}
                                        onPointerUp={() => {
                                            if (drag?.id !== b.id) return;
                                            const done = drag;
                                            setDrag(null);
                                            if (!done.moved) router.push(`/${tenant}/dashboard/documents/${b.id}`);
                                            else if (done.day) drop(b, done.day);
                                        }}
                                        onPointerCancel={() => setDrag(null)}
                                        className={`select-none touch-none rounded border-l-4 border px-1.5 py-1 text-[11px] leading-tight ${blockTone(b.jobStatus, false)} ${canEdit ? "cursor-grab" : "cursor-pointer"} ${drag?.id === b.id && drag.moved ? "opacity-40" : ""}`}
                                    >
                                        <p className="flex items-center justify-between gap-1 font-semibold tabular-nums">
                                            <span>{minuteLabel(b.start)}</span>
                                            <span className="text-[10px] font-normal opacity-70">{b.mechanicId ? initials.get(b.mechanicId) : "—"}</span>
                                        </p>
                                        {b.plate && <p className="truncate font-medium">{b.plate}</p>}
                                        <p className="truncate">{b.customer ?? "No customer"}</p>
                                    </li>
                                ))}
                                {mine.length === 0 && d.open && <li className="px-1 py-2 text-[11px] text-slate-400">Nothing booked</li>}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
