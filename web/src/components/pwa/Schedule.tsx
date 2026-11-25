"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@ui-sdk/react/drawer";
import {
    Calendar, CalendarDay, CalendarGrid, CalendarHeading, CalendarNext, CalendarPrevious, CalendarWeekday, CalendarWeekdays, CalendarWeeks,
} from "@ui-sdk/react/calendar";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from "@ui-sdk/react/accordion";
import { addDays } from "@/lib/diary/time";
import { minuteLabel } from "@/lib/diary/time";
import { hoursLabel } from "@/lib/time/clock";
import { scheduleAction } from "@/lib/time/floor-actions";
import type { ScheduleItem, ScheduleMonth } from "@/lib/time/floor-sheet";
import { JobSheet } from "@/components/pwa/JobSheet";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STATUS: Record<string, string> = {
    WAITING_FOR_PARTS: "Waiting for parts", WORK_IN_PROGRESS: "In progress", INSPECTION_IN_PROGRESS: "Being inspected", JOB_COMPLETE: "Done",
};
// The later in the week, the deeper the band: a week reads as a stack, nearest first.
const BAND = ["bg-white", "bg-slate-50", "bg-slate-100", "bg-slate-100", "bg-slate-200/60", "bg-slate-200/80", "bg-slate-200"];

const weekOf = (day: string) => {
    const monday = addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};
const dateLine = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const count = (n: number) => (n === 0 ? "Nothing booked" : n === 1 ? "1 job" : `${n} jobs`);

/**
 * The mechanic's schedule, from the floor app's header: the month as a
 * calendar with a mark on each day that has work, and the week of the chosen
 * day as a stack of days, the chosen one open with its jobs. A job opens its
 * sheet on top, and the schedule eases back beneath it.
 */
export function Schedule({
    tenant, initial, open, onOpenChange, startable, startLabel, runningId,
}: {
    tenant: string;
    initial: ScheduleMonth;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Today's jobs the mechanic can start from a sheet, by id. */
    startable: (id: string) => (() => void) | null;
    startLabel?: string;
    runningId: string | null;
}) {
    const [days, setDays] = useState<Record<string, ScheduleItem[]>>(initial.days);
    const [loaded, setLoaded] = useState<Set<string>>(() => new Set([initial.month]));
    const [day, setDay] = useState(initial.today);
    const [month, setMonth] = useState(initial.today.slice(0, 7));
    const [fetching, fetchMonth] = useTransition();
    const [jobId, setJobId] = useState<string | null>(null);

    const show = (next: string) => {
        setMonth(next);
        if (loaded.has(next)) return;
        fetchMonth(async () => {
            try {
                const more = await scheduleAction(tenant, next);
                setDays((d) => ({ ...d, ...more.days }));
                setLoaded((l) => new Set(l).add(next));
            } catch {
                // No signal: the calendar shows what it has, and asks again next time.
            }
        });
    };
    const pick = (next: string) => {
        setDay(next);
        if (next.slice(0, 7) !== month) show(next.slice(0, 7));
    };
    const week = weekOf(day);

    return (
        <Drawer open={open} onOpenChange={onOpenChange} side="bottom">
            <DrawerBackdrop className="fixed inset-0 bg-slate-900/40" />
            <DrawerContent className="mx-auto max-w-lg sm:border-x sm:border-slate-300 flex h-[92dvh] w-full flex-col border-t border-slate-300 bg-white [scale:calc(1-var(--drawer-stack,0)*0.04)]">
                <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300" />
                <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-1">
                    <div>
                        <DrawerTitle className="text-lg font-semibold text-slate-900">My schedule</DrawerTitle>
                        <DrawerDescription className="text-sm text-slate-600">Booked jobs by day. Choose a day to see its work.</DrawerDescription>
                    </div>
                    <DrawerClose aria-label="Close the schedule" className="floor-press -mr-2 grid h-11 w-11 place-items-center rounded-sm text-slate-600 active:bg-slate-100">
                        <X className="h-5 w-5" aria-hidden="true" />
                    </DrawerClose>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    <Calendar
                        value={day}
                        onValueChange={(next) => typeof next === "string" && pick(next)}
                        month={month}
                        onMonthChange={(next) => show(next)}
                        today={initial.today}
                        weekStartsOn={1}
                        locale="en-GB"
                        className="floor-calendar border-b border-slate-200 px-3 pb-3"
                        aria-busy={fetching || undefined}
                    >
                        <div className="flex items-center justify-between py-1">
                            <CalendarPrevious aria-label="Previous month" className="floor-press grid h-11 w-11 place-items-center rounded-sm text-slate-700 active:bg-slate-100">
                                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                            </CalendarPrevious>
                            <CalendarHeading className="text-base font-semibold text-slate-900" />
                            <CalendarNext aria-label="Next month" className="floor-press grid h-11 w-11 place-items-center rounded-sm text-slate-700 active:bg-slate-100">
                                <ChevronRight className="h-5 w-5" aria-hidden="true" />
                            </CalendarNext>
                        </div>
                        <CalendarGrid className="w-full border-collapse">
                            <CalendarWeekdays>
                                {(index) => <CalendarWeekday index={index} className="pb-1 text-center text-xs font-medium text-slate-600" />}
                            </CalendarWeekdays>
                            <CalendarWeeks>
                                {(cell) => (
                                    // The day is the table cell; the square inside it carries the look, from the cell's state.
                                    <CalendarDay value={cell.date} className="group py-0.5 outline-none">
                                        {(state) => (
                                            <span className="floor-press relative mx-auto grid h-11 w-11 place-items-center rounded-sm text-base tabular-nums text-slate-900 group-data-[outside]:text-slate-500 group-data-[today]:ring-1 group-data-[today]:ring-inset group-data-[today]:ring-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-1 group-focus-visible:outline-teal-700">
                                                <span>{state.label}</span>
                                                {(days[state.date]?.length ?? 0) > 0 && (
                                                    <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-teal-700 group-data-[selected]:bg-white" />
                                                )}
                                                {(days[state.date]?.length ?? 0) > 0 && <span className="sr-only">, {count(days[state.date].length)}</span>}
                                            </span>
                                        )}
                                    </CalendarDay>
                                )}
                            </CalendarWeeks>
                        </CalendarGrid>
                    </Calendar>

                    <Accordion value={[day]} onValueChange={(next) => next[0] && pick(next[0])} className="floor-days">
                        {week.map((d, i) => {
                            const items = days[d] ?? [];
                            const isToday = d === initial.today;
                            return (
                                <AccordionItem key={d} value={d} className={`border-b border-slate-200 data-[open]:bg-white ${BAND[i]}`}>
                                    <AccordionHeader>
                                        <AccordionTrigger className="floor-press flex w-full items-end justify-between gap-3 px-4 py-4 text-left">
                                            <span className="min-w-0">
                                                <span className="block text-[28px] font-bold uppercase leading-none tracking-[-0.02em] text-slate-900">{WEEKDAY[new Date(`${d}T12:00:00Z`).getUTCDay()]}</span>
                                                <span className="mt-1 block text-sm text-slate-600">{dateLine(d)}{isToday ? " · Today" : ""}</span>
                                            </span>
                                            <span className={`shrink-0 text-sm tabular-nums ${items.length ? "font-medium text-slate-900" : "text-slate-600"}`}>{count(items.length)}</span>
                                        </AccordionTrigger>
                                    </AccordionHeader>
                                    <AccordionPanel>
                                        {items.length === 0 ? (
                                            <p className="px-4 pb-4 text-base text-slate-600">Nothing booked for you{isToday ? " today" : ""}.</p>
                                        ) : (
                                            <ul className="px-4 pb-4">
                                                {items.map((item) => (
                                                    <li key={item.id}>
                                                        <button type="button" onClick={() => setJobId(item.id)} className="floor-press flex w-full items-start gap-3 border-t border-slate-100 py-3 text-left first:border-t-0">
                                                            <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-900">{item.minute === null ? "Now" : minuteLabel(item.minute)}</span>
                                                            <span className="min-w-0 flex-1">
                                                                <span className="flex flex-wrap items-center gap-2 text-sm">
                                                                    {item.jobNumber && <span className="font-semibold text-slate-900">{item.jobNumber}</span>}
                                                                    {item.plate && <span className="rounded-sm bg-yellow-100 px-1.5 font-bold text-yellow-900">{item.plate}</span>}
                                                                    {item.id === runningId && <span className="font-medium text-teal-700">On the clock</span>}
                                                                </span>
                                                                <span className="block text-base font-semibold text-slate-900">{item.title}</span>
                                                                <span className="block text-sm text-slate-600">
                                                                    {[item.estimatedMinutes ? `about ${hoursLabel(item.estimatedMinutes)}` : null, item.status ? STATUS[item.status] : null].filter(Boolean).join(" · ") || " "}
                                                                </span>
                                                            </span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </AccordionPanel>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </div>

                <JobSheet tenant={tenant} jobId={jobId} onClose={() => setJobId(null)} start={jobId ? startable(jobId) : null} startLabel={startLabel} onTheClock={jobId !== null && jobId === runningId} />
            </DrawerContent>
        </Drawer>
    );
}
