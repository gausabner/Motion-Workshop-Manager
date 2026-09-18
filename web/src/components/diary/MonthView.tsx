import Link from "next/link";
import type { DiarySettings } from "@/lib/diary/capacity";
import type { DiaryDay } from "@/lib/diary/queries";
import { WEEKDAY_SHORT, loadTone } from "@/components/diary/shared";

/**
 * The month as a heat map of how full each day is — the view for "when can
 * you fit me in?" on the phone, where the answer is the first green square.
 */
export function MonthView({ days, month, settings, today, hrefForDay }: { days: DiaryDay[]; month: string; settings: DiarySettings; today: string; hrefForDay: (day: string) => string }) {
    return (
        <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-7 gap-px border border-slate-200 bg-slate-200">
                {[1, 2, 3, 4, 5, 6, 7].map((w) => (
                    <div key={w} className="bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{WEEKDAY_SHORT[w]}</div>
                ))}
                {days.map((d) => {
                    const inMonth = d.day.startsWith(month);
                    const tone = loadTone(d.load, settings.fullAtPercent);
                    const full = d.open && d.load.percent >= settings.fullAtPercent;
                    return (
                        <Link
                            key={d.day}
                            href={hrefForDay(d.day)}
                            className={`min-h-[76px] px-2 py-1.5 hover:bg-teal-50 ${inMonth ? "bg-white" : "bg-slate-50 text-slate-400"} ${d.day === today ? "outline outline-2 -outline-offset-2 outline-teal-500" : ""}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold ${inMonth ? "text-slate-700" : ""}`}>{Number(d.day.slice(8))}</span>
                                {full && <span className="rounded-sm bg-red-100 px-1 text-[9px] font-bold uppercase text-red-700">Full</span>}
                            </div>
                            {d.open ? (
                                <>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                        <div className={`h-full ${tone.bar}`} style={{ width: `${Math.min(d.load.percent, 100)}%` }} />
                                    </div>
                                    <p className={`mt-1 text-[10px] tabular-nums ${tone.text}`}>
                                        {d.bookings.length ? `${d.bookings.length} booked · ${d.load.percent}%` : "Open"}
                                    </p>
                                </>
                            ) : (
                                <p className="mt-2 text-[10px] text-slate-400">{d.bookings.length ? `${d.bookings.length} booked` : "Closed"}</p>
                            )}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
