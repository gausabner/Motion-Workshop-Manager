import { ArrowUpRight, Check, Clock } from "lucide-react";

/**
 * The light cards floating over the dark hero.
 *
 * The reference shows a sales dashboard. These show a workshop's actual
 * afternoon — a job on a ramp, what the month made, the bays — because the
 * person reading this runs a workshop and a screenshot of somebody else's
 * revenue chart proves nothing to them. Invented figures, plausible ones,
 * labelled as an illustration in the markup rather than dressed as a customer.
 *
 * They lift on scroll and on hover; the motion is in the parent so the whole
 * cluster behaves as one object rather than three things twitching separately.
 */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`rounded-2xl border border-white/10 bg-white/95 p-4 shadow-2xl shadow-teal-950/40 backdrop-blur ${className}`}
        >
            {children}
        </div>
    );
}

export function HeroCards() {
    return (
        <div aria-hidden className="relative mx-auto mt-14 w-full max-w-4xl">
            <div className="grid gap-4 sm:grid-cols-3">
                {/* On the floor now */}
                <Card className="sm:translate-y-6">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">On the floor</p>
                    <p className="mt-2 text-[26px] font-semibold tabular-nums leading-none tracking-tight text-slate-900">7</p>
                    <p className="mt-1 text-[12px] text-slate-500">jobs open across 4 bays</p>
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                        {[
                            ["N 12345 W", "In progress"],
                            ["N 4521 WB", "Waiting for parts"],
                        ].map(([plate, status]) => (
                            <div key={plate} className="flex items-center justify-between gap-2">
                                <span className="text-[12px] font-medium text-slate-800">{plate}</span>
                                <span className="text-[11px] text-slate-500">{status}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* The month */}
                <Card>
                    <div className="flex items-start justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Invoiced this month</p>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                    </div>
                    <p className="mt-2 text-[26px] font-semibold tabular-nums leading-none tracking-tight text-slate-900">
                        N$ 142,380
                    </p>
                    <p className="mt-1 text-[12px] text-teal-700">+12% on last month</p>
                    {/* A bar row, drawn from fixed heights rather than a chart
                        library: it is an illustration, and shipping a charting
                        dependency to draw eight rectangles would be silly. */}
                    <div className="mt-4 flex h-12 items-end gap-1.5">
                        {[38, 52, 44, 66, 58, 79, 71, 96].map((h, i) => (
                            <span
                                key={i}
                                className="flex-1 rounded-t-[3px] bg-gradient-to-t from-teal-600/25 to-teal-500"
                                style={{ height: `${h}%` }}
                            />
                        ))}
                    </div>
                </Card>

                {/* Waiting on you */}
                <Card className="sm:translate-y-10">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Waiting on you</p>
                    <ul className="mt-3 space-y-2.5">
                        {[
                            { icon: Check, text: "3 quotes to follow up", tone: "text-teal-700 bg-teal-50" },
                            { icon: Clock, text: "2 discs expire this month", tone: "text-amber-700 bg-amber-50" },
                            { icon: Check, text: "Month-end export ready", tone: "text-teal-700 bg-teal-50" },
                        ].map((row) => (
                            <li key={row.text} className="flex items-center gap-2.5">
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${row.tone}`}>
                                    <row.icon className="h-3 w-3" strokeWidth={2.5} />
                                </span>
                                <span className="text-[12px] leading-snug text-slate-700">{row.text}</span>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </div>
    );
}
