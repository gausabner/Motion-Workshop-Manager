"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { clashes, lanesWithin, snapMinute, type DiarySettings } from "@/lib/diary/capacity";
import { minuteLabel } from "@/lib/diary/time";
import { bookSlotAction, moveBookingAction } from "@/lib/diary/actions";
import type { DiaryBooking, DiaryDay, DiaryMechanic } from "@/lib/diary/queries";
import { PX_PER_MINUTE, blockTone, capture, loadTone } from "@/components/diary/shared";

type Props = {
    tenant: string;
    day: DiaryDay;
    mechanics: DiaryMechanic[];
    settings: DiarySettings;
    /** Minute of "now" when this day is today, for the red line. */
    nowMinute: number | null;
    canEdit: boolean;
};

const UNASSIGNED = "__unassigned";

type Drag =
    | { kind: "move"; id: string; grab: number; pointerX: number; pointerY: number; moved: boolean; lane: string | null; minute: number }
    | { kind: "resize"; id: string; top: number; minutes: number };

/**
 * One column per mechanic (R4), the benchmark's day view — with the parts it
 * leaves out: an Unassigned lane so nothing booked is invisible, clashes drawn
 * in red rather than prevented, time off shaded with its reason, and drag that
 * works on a tablet because it runs on pointer events, not HTML drag-and-drop.
 */
export function DayView({ tenant, day, mechanics, settings, nowMinute, canEdit }: Props) {
    const router = useRouter();
    const [bookings, setBookings] = useState<DiaryBooking[]>(day.bookings);
    const [drag, setDrag] = useState<Drag | null>(null);
    const [slot, setSlot] = useState<{ lane: string; minute: number } | null>(null);
    const [error, setError] = useState<string>();
    const [pending, start] = useTransition();
    const laneRefs = useRef(new Map<string, HTMLDivElement>());

    // The visible span is the shop's hours, stretched to fit anything booked outside them.
    const range = useMemo(() => {
        const starts = bookings.map((b) => b.start);
        const ends = bookings.map((b) => b.start + b.minutes);
        const slotSize = settings.slotMinutes;
        const from = Math.floor(Math.min(settings.opensAt, ...starts) / slotSize) * slotSize;
        const to = Math.ceil(Math.max(settings.closesAt, ...ends) / slotSize) * slotSize;
        return { start: Math.max(0, from), end: Math.min(1440, to) };
    }, [bookings, settings]);
    const height = (range.end - range.start) * PX_PER_MINUTE;
    const y = (minute: number) => (minute - range.start) * PX_PER_MINUTE;

    const lanes = [
        { id: UNASSIGNED, name: "Unassigned", initials: "—" },
        ...mechanics,
    ];
    const laneOf = (b: DiaryBooking) => b.mechanicId ?? UNASSIGNED;

    /** Which lane and minute sit under a point on the screen. */
    function locate(clientX: number, clientY: number, grab: number): { lane: string; minute: number } | null {
        for (const [lane, el] of laneRefs.current) {
            const rect = el.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right) {
                const raw = range.start + (clientY - rect.top) / PX_PER_MINUTE - grab;
                return { lane, minute: snapMinute(raw, settings, range) };
            }
        }
        return null;
    }

    function commit(id: string, change: { lane?: string; minute?: number; minutes?: number }) {
        const before = bookings;
        const current = before.find((b) => b.id === id);
        if (!current) return;
        const next: DiaryBooking = {
            ...current,
            start: change.minute ?? current.start,
            minutes: change.minutes ?? current.minutes,
            mechanicId: change.lane === undefined ? current.mechanicId : change.lane === UNASSIGNED ? null : change.lane,
        };
        if (next.start === current.start && next.minutes === current.minutes && next.mechanicId === current.mechanicId) return;
        setBookings(before.map((b) => (b.id === id ? next : b)));
        setError(undefined);
        start(async () => {
            const result = await moveBookingAction(tenant, {
                documentId: id,
                day: day.day,
                minute: next.start,
                mechanicId: next.mechanicId,
                ...(change.minutes !== undefined ? { minutes: next.minutes } : {}),
            });
            if (!result.ok) {
                setBookings(before);
                setError(result.message);
            } else {
                router.refresh();
            }
        });
    }

    function onBlockPointerDown(e: React.PointerEvent, booking: DiaryBooking) {
        if (!canEdit || e.button !== 0) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        capture(e);
        setSlot(null);
        setDrag({ kind: "move", id: booking.id, grab: (e.clientY - rect.top) / PX_PER_MINUTE, pointerX: e.clientX, pointerY: e.clientY, moved: false, lane: laneOf(booking), minute: booking.start });
    }

    function onBlockPointerMove(e: React.PointerEvent) {
        if (drag?.kind !== "move") return;
        const moved = drag.moved || Math.abs(e.clientX - drag.pointerX) + Math.abs(e.clientY - drag.pointerY) > 5;
        const target = moved ? locate(e.clientX, e.clientY, drag.grab) : null;
        setDrag({ ...drag, moved, lane: target?.lane ?? drag.lane, minute: target?.minute ?? drag.minute });
    }

    function onBlockPointerUp(booking: DiaryBooking) {
        if (drag?.kind !== "move") return;
        const done = drag;
        setDrag(null);
        // No movement means it was a click: open the job.
        if (!done.moved) {
            router.push(`/${tenant}/dashboard/documents/${booking.id}`);
            return;
        }
        commit(booking.id, { lane: done.lane ?? undefined, minute: done.minute });
    }

    function onResizeDown(e: React.PointerEvent, booking: DiaryBooking) {
        if (!canEdit) return;
        e.stopPropagation();
        capture(e);
        const block = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
        setDrag({ kind: "resize", id: booking.id, top: block.top, minutes: booking.minutes });
    }

    function onResizeMove(e: React.PointerEvent) {
        if (drag?.kind !== "resize") return;
        const raw = (e.clientY - drag.top) / PX_PER_MINUTE;
        const minutes = Math.max(settings.slotMinutes, Math.round(raw / settings.slotMinutes) * settings.slotMinutes);
        if (minutes !== drag.minutes) setDrag({ ...drag, minutes });
    }

    function onResizeUp() {
        if (drag?.kind !== "resize") return;
        const done = drag;
        setDrag(null);
        commit(done.id, { minutes: done.minutes });
    }

    /** A click on bare lane offers a booking in the slot under it — floored, so it lands in the slot clicked. */
    function onLaneClick(e: React.MouseEvent, lane: string) {
        if (!canEdit || e.target !== e.currentTarget) return;
        const raw = range.start + (e.clientY - e.currentTarget.getBoundingClientRect().top) / PX_PER_MINUTE;
        setSlot({ lane, minute: Math.floor(raw / settings.slotMinutes) * settings.slotMinutes });
    }

    const slots: number[] = [];
    for (let m = range.start; m < range.end; m += settings.slotMinutes) slots.push(m);

    return (
        <div className="space-y-2">
            {error && <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error} — it has been put back.</p>}
            <div className="overflow-x-auto border border-slate-200 bg-white">
                <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${lanes.length}, minmax(150px, 1fr))` }}>
                    {/* Lane headers */}
                    <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50" />
                    {lanes.map((lane) => {
                        const info = day.lanes.find((l) => l.mechanicId === lane.id);
                        const tone = info ? loadTone(info.load, settings.fullAtPercent) : null;
                        const count = bookings.filter((b) => laneOf(b) === lane.id).length;
                        return (
                            <div key={lane.id} className="sticky top-0 z-20 border-b border-l border-slate-200 bg-slate-50 px-2 py-1.5">
                                <p className="truncate text-xs font-semibold text-slate-700">{lane.name}</p>
                                {info ? (
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                                            <div className={`h-full ${tone!.bar}`} style={{ width: `${Math.min(info.load.percent, 100)}%` }} />
                                        </div>
                                        <span className={`text-[10px] tabular-nums ${tone!.text}`}>{info.working ? `${info.load.percent}%` : "Off"}</span>
                                    </div>
                                ) : (
                                    <p className="mt-0.5 text-[10px] text-slate-400">{count ? `${count} to place` : "Nothing waiting"}</p>
                                )}
                            </div>
                        );
                    })}

                    {/* Time gutter */}
                    <div className="relative border-r border-slate-200" style={{ height }}>
                        {slots.map((m) => (
                            <span key={m} className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-slate-400" style={{ top: y(m) }}>
                                {m % 60 === 0 ? minuteLabel(m) : ""}
                            </span>
                        ))}
                    </div>

                    {/* Lanes */}
                    {lanes.map((lane) => {
                        const info = day.lanes.find((l) => l.mechanicId === lane.id);
                        const mine = bookings.filter((b) => laneOf(b) === lane.id);
                        const clashing = lane.id === UNASSIGNED ? new Set<string>() : clashes(mine.map((b) => ({ id: b.id, mechanicId: b.mechanicId, start: b.start, minutes: b.minutes })));
                        const layout = lanesWithin(mine.map((b) => ({ id: b.id, mechanicId: b.mechanicId, start: b.start, minutes: b.minutes })));
                        const target = drag?.kind === "move" && drag.moved && drag.lane === lane.id ? drag : null;
                        const dragged = target ? bookings.find((b) => b.id === target.id) : null;
                        return (
                            <div
                                key={lane.id}
                                ref={(el) => { if (el) laneRefs.current.set(lane.id, el); else laneRefs.current.delete(lane.id); }}
                                onClick={(e) => onLaneClick(e, lane.id)}
                                className={`relative border-l border-slate-200 ${lane.id === UNASSIGNED ? "bg-slate-50/60" : ""} ${canEdit ? "cursor-cell" : ""}`}
                                style={{ height }}
                                data-lane={lane.id}
                            >
                                {/* Slot lines */}
                                {slots.map((m) => (
                                    <div key={m} className={`pointer-events-none absolute inset-x-0 border-t ${m % 60 === 0 ? "border-slate-200" : "border-slate-100"}`} style={{ top: y(m) }} />
                                ))}
                                {/* Outside this mechanic's hours */}
                                {info && (!info.working ? (
                                    <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,#f1f5f9,#f1f5f9_6px,#e2e8f0_6px,#e2e8f0_12px)]" />
                                ) : (
                                    <>
                                        {info.working.start > range.start && <div className="pointer-events-none absolute inset-x-0 top-0 bg-slate-100/80" style={{ height: y(info.working.start) }} />}
                                        {info.working.end < range.end && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-100/80" style={{ top: y(info.working.end) }} />}
                                    </>
                                ))}
                                {/* Time off */}
                                {info?.off.map((o, i) => (
                                    <div
                                        key={i}
                                        className="pointer-events-none absolute inset-x-0 border-y border-dashed border-slate-400 bg-[repeating-linear-gradient(135deg,#f8fafc,#f8fafc_6px,#e2e8f0_6px,#e2e8f0_12px)] px-2 py-1"
                                        style={{ top: y(Math.max(o.start, range.start)), height: (Math.min(o.end, range.end) - Math.max(o.start, range.start)) * PX_PER_MINUTE }}
                                    >
                                        <span className="text-[10px] font-medium text-slate-500">{o.reason ?? "Away"}</span>
                                    </div>
                                ))}
                                {/* Now */}
                                {nowMinute !== null && nowMinute >= range.start && nowMinute <= range.end && (
                                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: y(nowMinute) }} />
                                )}
                                {/* Where a dragged booking will land */}
                                {target && dragged && (
                                    <div className="pointer-events-none absolute inset-x-1 z-20 rounded border-2 border-dashed border-teal-600 bg-teal-100/60" style={{ top: y(target.minute), height: dragged.minutes * PX_PER_MINUTE }}>
                                        <span className="px-1 text-[10px] font-semibold text-teal-800">{minuteLabel(target.minute)}</span>
                                    </div>
                                )}
                                {/* A clicked empty slot offers a booking there */}
                                {slot?.lane === lane.id && (
                                    <button
                                        type="button" disabled={pending}
                                        onClick={() => start(() => bookSlotAction(tenant, { day: day.day, minute: slot.minute, mechanicId: lane.id === UNASSIGNED ? null : lane.id }))}
                                        className="absolute inset-x-1 z-20 flex items-center gap-1 rounded border border-teal-600 bg-white px-2 text-xs font-medium text-teal-700 shadow-sm hover:bg-teal-50"
                                        style={{ top: y(slot.minute), height: settings.slotMinutes * PX_PER_MINUTE }}
                                    >
                                        <Plus className="w-3.5 h-3.5" />Book {minuteLabel(slot.minute)}{lane.id === UNASSIGNED ? "" : ` with ${lane.name.split(" ")[0]}`}
                                    </button>
                                )}
                                {/* Bookings */}
                                {mine.map((b) => {
                                    const place = layout[b.id] ?? { column: 0, columns: 1 };
                                    const resizing = drag?.kind === "resize" && drag.id === b.id ? drag.minutes : null;
                                    const moving = drag?.kind === "move" && drag.id === b.id && drag.moved;
                                    const minutes = resizing ?? b.minutes;
                                    const width = 100 / place.columns;
                                    return (
                                        <div
                                            key={b.id}
                                            onPointerDown={(e) => onBlockPointerDown(e, b)}
                                            onPointerMove={onBlockPointerMove}
                                            onPointerUp={() => onBlockPointerUp(b)}
                                            onPointerCancel={() => setDrag(null)}
                                            title={`${minuteLabel(b.start)}–${minuteLabel(b.start + minutes)} · ${b.plate ?? ""} ${b.customer ?? ""}${clashing.has(b.id) ? " · clashes with another booking" : ""}`}
                                            className={`absolute z-10 select-none overflow-hidden rounded border-l-4 border px-1.5 py-0.5 text-[11px] leading-tight shadow-sm touch-none ${blockTone(b.jobStatus, clashing.has(b.id))} ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${moving ? "opacity-40" : ""}`}
                                            style={{ top: y(b.start) + 1, height: Math.max(minutes * PX_PER_MINUTE - 2, 18), left: `calc(${place.column * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
                                        >
                                            <p className="font-semibold tabular-nums">
                                                {minuteLabel(b.start)}{b.plate && <span className="ml-1 rounded-sm bg-yellow-100 px-1 text-yellow-900">{b.plate}</span>}
                                            </p>
                                            <p className="truncate">{b.customer ?? "No customer"}</p>
                                            {minutes >= 60 && <p className="truncate opacity-80">{b.description ?? b.vehicle ?? ""}</p>}
                                            {b.orphaned && <p className="truncate text-red-700">Mechanic no longer on diary</p>}
                                            {canEdit && (
                                                <div
                                                    onPointerDown={(e) => onResizeDown(e, b)}
                                                    onPointerMove={onResizeMove}
                                                    onPointerUp={onResizeUp}
                                                    className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                                                    aria-label="Drag to change how long it takes"
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
            <p className="text-[11px] text-slate-400">
                Drag a booking to move it, drag its bottom edge to change how long it takes, click an empty slot to book it. Red outlines are clashes — allowed, just visible.
            </p>
        </div>
    );
}
