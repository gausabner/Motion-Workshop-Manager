import { Check } from "lucide-react";

/**
 * Where somebody is in getting back into their account.
 *
 * Three steps, shown on every screen of the flow. It exists because a password
 * reset is the one journey a user takes while already annoyed, and it crosses
 * an email client — they leave the browser at step two and come back minutes
 * later, possibly on a different device, with no memory of what they had
 * started. A stepper is what tells them this is the same errand and how much
 * of it is left.
 *
 * It is a `<ol>` with the current step carrying `aria-current`, so the
 * progression is in the markup rather than only in colour. The bar is drawn
 * from the same state, never animated on load: somebody reading this wants to
 * know where they are, not to watch it arrive.
 */

export const RESET_STEPS = [
    { id: "ask", label: "Your email" },
    { id: "sent", label: "Check your inbox" },
    { id: "set", label: "New password" },
] as const;

export type ResetStep = (typeof RESET_STEPS)[number]["id"];

export function ResetProgress({ current }: { current: ResetStep }) {
    const index = RESET_STEPS.findIndex((s) => s.id === current);
    // Half a segment past the last done step, so the bar sits under the live
    // one rather than pointing at the next. At step one it is not empty —
    // starting at zero reads as "nothing has happened yet" when something has.
    const percent = ((index + 0.5) / RESET_STEPS.length) * 100;

    return (
        <div className="w-full">
            <div aria-hidden className="relative h-1 overflow-hidden rounded-full bg-slate-200">
                <span
                    className="absolute inset-y-0 left-0 rounded-full bg-teal-600 motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <ol className="mt-3 flex items-center justify-between gap-2">
                {RESET_STEPS.map((step, i) => {
                    const done = i < index;
                    const live = i === index;
                    return (
                        <li
                            key={step.id}
                            aria-current={live ? "step" : undefined}
                            className="flex min-w-0 items-center gap-1.5"
                        >
                            <span
                                aria-hidden
                                className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold tabular ${
                                    done
                                        ? "bg-teal-600 text-white"
                                        : live
                                          ? "bg-teal-600/15 text-teal-700 ring-1 ring-inset ring-teal-600"
                                          : "bg-slate-200 text-slate-500"
                                }`}
                            >
                                {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
                            </span>
                            <span
                                className={`truncate text-[11px] ${
                                    live ? "font-medium text-slate-900" : "text-slate-500"
                                }`}
                            >
                                {step.label}
                            </span>
                            {/* The step number is already announced by the list;
                                this says which of how many without relying on
                                the bar, which is decorative. */}
                            <span className="sr-only">
                                {done ? "completed" : live ? `step ${i + 1} of ${RESET_STEPS.length}, current` : "not started"}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
