"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Inbox } from "lucide-react";
import type { Diary } from "@/lib/diary/queries";
import { addDays } from "@/lib/diary/time";
import { DayView } from "@/components/diary/DayView";
import { WeekView } from "@/components/diary/WeekView";
import { MonthView } from "@/components/diary/MonthView";
import { dayHeading, loadTone } from "@/components/diary/shared";

export type DiaryMode = "day" | "week" | "month";

type Props = {
    tenant: string;
    diary: Diary;
    mode: DiaryMode;
    /** The day the diary is anchored on — the day shown, or a day in the week or month shown. */
    anchor: string;
    today: string;
    nowMinute: number;
    /** Which page of mechanic columns the day view shows. */
    page: number;
    canEdit: boolean;
    canManageHours: boolean;
    /** Online requests waiting for someone to approve them. */
    pendingRequests: number;
};

/**
 * The booking diary (R4): day, week and month, with the date and the page of
 * mechanics in the URL so a view can be bookmarked or shared across the desk.
 */
export function DiaryView({ tenant, diary, mode, anchor, today, nowMinute, page, canEdit, canManageHours, pendingRequests }: Props) {
    const base = `/${tenant}/dashboard/schedule`;
    const href = (next: { mode?: DiaryMode; day?: string; page?: number }) => {
        const params = new URLSearchParams();
        params.set("view", next.mode ?? mode);
        params.set("date", next.day ?? anchor);
        const p = next.page ?? (next.mode && next.mode !== mode ? 0 : page);
        if (p > 0) params.set("page", String(p));
        return `${base}?${params}`;
    };
    const hrefForDay = (day: string) => href({ mode: "day", day, page: 0 });

    const step = mode === "day" ? 1 : mode === "week" ? 7 : 0;
    const prev = mode === "month" ? shiftMonth(anchor, -1) : addDays(anchor, -step);
    const next = mode === "month" ? shiftMonth(anchor, 1) : addDays(anchor, step);

    const perPage = diary.settings.lanesPerPage;
    const pages = Math.max(1, Math.ceil(diary.mechanics.length / perPage));
    const shownPage = Math.min(page, pages - 1);
    const shownMechanics = diary.mechanics.slice(shownPage * perPage, shownPage * perPage + perPage);

    const focus = mode === "day" ? diary.days.find((d) => d.day === anchor) : null;
    const inRange = mode === "month" ? diary.days.filter((d) => d.day.startsWith(anchor.slice(0, 7))) : diary.days;
    const available = inRange.reduce((s, d) => s + d.load.available, 0);
    const booked = inRange.reduce((s, d) => s + d.load.booked, 0);
    const summary = focus?.load ?? { available, booked, percent: available ? Math.round((booked / available) * 100) : booked ? 100 : 0 };
    const tone = loadTone(summary, diary.settings.fullAtPercent);
    const title = mode === "day" ? dayHeading(anchor) : mode === "week" ? `Week of ${dayHeading(diary.from, "short")}` : monthName(anchor);

    return (
        <div className="max-w-[1400px] mx-auto space-y-3 pb-12">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <CalendarDays className="w-6 h-6 text-slate-400" />
                    <div>
                        <h1 className="text-xl font-bold leading-tight text-slate-800">{title}</h1>
                        <p className="text-xs text-slate-500">
                            <span className={`font-semibold ${tone.text}`}>{summary.percent}% booked</span>
                            {" · "}{hours(summary.booked)} of {hours(summary.available)} mechanic hours
                            {summary.percent >= diary.settings.fullAtPercent && <span className="ml-1 rounded-sm bg-red-100 px-1 text-[10px] font-bold uppercase text-red-700">Full</span>}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
                        {(["day", "week", "month"] as const).map((m) => (
                            <Link key={m} href={href({ mode: m })} className={`px-3 py-1.5 capitalize ${m === mode ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{m}</Link>
                        ))}
                    </div>
                    <div className="flex items-center overflow-hidden rounded-md border border-slate-300 bg-white text-sm">
                        <Link href={href({ day: prev })} aria-label="Previous" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></Link>
                        <Link href={href({ day: today })} className="border-x border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Today</Link>
                        <Link href={href({ day: next })} aria-label="Next" className="px-2 py-1.5 text-slate-600 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></Link>
                    </div>
                    <form method="get" action={base} className="flex items-center">
                        <input type="hidden" name="view" value={mode} />
                        <input type="date" name="date" defaultValue={anchor} aria-label="Go to date" onChange={(e) => e.currentTarget.form?.requestSubmit()} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm" />
                    </form>
                    {mode === "day" && pages > 1 && (
                        <div className="flex items-center overflow-hidden rounded-md border border-slate-300 bg-white text-xs">
                            <Link href={href({ page: Math.max(0, shownPage - 1) })} aria-label="Previous mechanics" className={`px-2 py-1.5 ${shownPage === 0 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-50"}`}><ChevronLeft className="w-4 h-4" /></Link>
                            <span className="border-x border-slate-300 px-2 py-1.5 tabular-nums text-slate-600">Mechanics {shownPage * perPage + 1}–{Math.min(diary.mechanics.length, shownPage * perPage + perPage)} of {diary.mechanics.length}</span>
                            <Link href={href({ page: Math.min(pages - 1, shownPage + 1) })} aria-label="Next mechanics" className={`px-2 py-1.5 ${shownPage >= pages - 1 ? "pointer-events-none text-slate-300" : "text-slate-600 hover:bg-slate-50"}`}><ChevronRight className="w-4 h-4" /></Link>
                        </div>
                    )}
                    {canManageHours && (
                        <Link href={`${base}/hours`} className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"><Clock className="w-3.5 h-3.5" />Hours &amp; leave</Link>
                    )}
                </div>
            </div>

            {pendingRequests > 0 && (
                <Link href={`${base}/requests`} className="flex items-center gap-2 rounded-sm border border-teal-300 bg-teal-50 px-4 py-2 text-sm text-teal-900 hover:bg-teal-100">
                    <Inbox className="w-4 h-4" />
                    <span><strong>{pendingRequests}</strong> online booking request{pendingRequests === 1 ? "" : "s"} waiting for approval</span>
                </Link>
            )}

            {diary.mechanics.length === 0 && (
                <p className="rounded-sm border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                    Nobody is set up as a mechanic yet, so every booking lands in Unassigned. Mark staff as mechanics under Admin → Mechanics.
                </p>
            )}

            {mode === "day" && focus && (
                // Keyed on the data, so a refresh after a move starts from what the server now says.
                <DayView
                    key={signature(focus.bookings) + shownPage}
                    tenant={tenant}
                    day={focus}
                    mechanics={shownMechanics}
                    settings={diary.settings}
                    nowMinute={anchor === today ? nowMinute : null}
                    canEdit={canEdit}
                />
            )}
            {mode === "week" && (
                <WeekView
                    key={signature(diary.days.flatMap((d) => d.bookings))}
                    tenant={tenant}
                    days={diary.days}
                    mechanics={diary.mechanics}
                    settings={diary.settings}
                    today={today}
                    hrefForDay={hrefForDay}
                    canEdit={canEdit}
                />
            )}
            {mode === "month" && <MonthView days={diary.days} month={anchor.slice(0, 7)} settings={diary.settings} today={today} hrefForDay={hrefForDay} />}
        </div>
    );
}

function signature(bookings: { id: string; day: string; start: number; minutes: number; mechanicId: string | null }[]): string {
    return bookings.map((b) => `${b.id}:${b.day}:${b.start}:${b.minutes}:${b.mechanicId ?? ""}`).join("|");
}

function hours(minutes: number): string {
    const h = minutes / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

function shiftMonth(day: string, by: number): string {
    const [y, m] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 10);
}

function monthName(day: string): string {
    const [y, m] = day.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
