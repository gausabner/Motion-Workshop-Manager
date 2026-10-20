import { Check } from "lucide-react";
import type { ChangeKind } from "@/lib/billing/plan-change";

/**
 * Where a plan change stands, as a segmented rule across the top of the flow.
 *
 * Drawn the way the rest of the app draws structure: a hairline per step, teal
 * once the step is reached — the same teal that marks "you are here" in the
 * rails. No pills and no circles; a ledger page shows progress the way a
 * ruled form does.
 *
 * The last two steps are not the owner's to take: paying (or waiting for an
 * approval) and the switch itself happen on MOTION's side. Showing them anyway
 * is the point — the owner can see that the request is not finished when they
 * press the button, and what is still to come.
 *
 * Motion: a reached segment fills from the left. It happens once per step of a
 * flow somebody runs a few times a year, so it is allowed to be seen — 240ms on
 * the strong ease-out, transform only, and nothing at all under reduced motion,
 * where the colour is already the whole message. The page keeps this element
 * mounted between steps (one route, the step in the query string), so the fill
 * runs as a real transition rather than appearing finished.
 */

export function changeSteps(kind: ChangeKind | null): string[] {
    return kind === "downgrade"
        ? ["Choose a plan", "Review", "Approval", "Applied"]
        : ["Choose a plan", "Review", "Payment", "Switched on"];
}

export function ChangeProgress({ kind, current }: { kind: ChangeKind | null; current: number }) {
    const steps = changeSteps(kind);
    return (
        <nav aria-label="Plan change progress">
            <ol className="grid grid-cols-4 gap-x-2 sm:gap-x-3">
                {steps.map((label, i) => {
                    const done = i < current;
                    const live = i === current;
                    return (
                        <li key={label} aria-current={live ? "step" : undefined} className="min-w-0">
                            <span aria-hidden className="relative block h-[3px] overflow-hidden bg-slate-200">
                                <span
                                    className={`absolute inset-0 origin-left bg-teal-700 motion-safe:transition-transform motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] ${
                                        done || live ? "scale-x-100" : "scale-x-0"
                                    }`}
                                />
                            </span>
                            <span aria-hidden className="mt-2 hidden items-center gap-1.5 sm:flex">
                                {done ? (
                                    <Check aria-hidden className="h-3 w-3 shrink-0 text-teal-700" strokeWidth={2.5} />
                                ) : (
                                    <span aria-hidden className={`text-[11px] font-semibold tabular-nums ${live ? "text-teal-700" : "text-slate-500"}`}>
                                        {i + 1}
                                    </span>
                                )}
                                <span className={`truncate text-[12px] ${live ? "font-medium text-slate-900" : done ? "text-slate-600" : "text-slate-500"}`}>
                                    {label}
                                </span>
                            </span>
                            {/* Read at every width, including where the visible label is hidden. */}
                            <span className="sr-only">
                                {label}
                                {done ? ", completed" : live ? `, step ${i + 1} of ${steps.length}, current` : ", not yet"}
                            </span>
                        </li>
                    );
                })}
            </ol>
            {/* Four labels do not fit a phone without being cut short, so below
                sm the segments carry the count and one line names the step. */}
            <p className="mt-2 text-[12px] text-slate-600 sm:hidden" aria-hidden>
                Step {Math.min(current, steps.length - 1) + 1} of {steps.length}: <span className="font-medium text-slate-900">{steps[Math.min(current, steps.length - 1)]}</span>
            </p>
        </nav>
    );
}
