import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { setupProgress, type SetupStep } from "@/lib/setup/checklist";

/** The dashboard's first card until the workshop is ready to run a day on MOTION. Disappears by itself once it is. */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
    const progress = setupProgress(steps);
    if (progress.complete) return null;
    const next = steps.find((s) => !s.done && !s.optional);
    return (
        <section className="border border-teal-200 rounded-sm bg-white" aria-labelledby="setup-heading">
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-teal-100 bg-teal-50/60">
                <div>
                    <h2 id="setup-heading" className="text-sm font-semibold text-slate-800">Get your workshop ready</h2>
                    <p className="text-xs text-slate-500">{progress.done} of {progress.total} done. Each step opens the screen that does it.</p>
                </div>
                <div className="h-1.5 w-32 rounded-full bg-teal-100" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="Setup progress">
                    <div className="h-1.5 rounded-full bg-teal-600" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
            </div>
            <ol className="divide-y divide-slate-100">
                {steps.map((step) => (
                    <li key={step.key}>
                        <Link href={step.href} className={`flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 ${step === next ? "bg-teal-50/40" : ""}`}>
                            {step.done
                                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-label="Done" />
                                : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-label="Not done" />}
                            <span className="flex-1 min-w-0">
                                <span className={`block text-sm ${step.done ? "text-slate-400 line-through decoration-slate-300" : "text-slate-800 font-medium"}`}>
                                    {step.title}{step.optional && <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wider text-slate-400 no-underline">optional</span>}
                                </span>
                                {!step.done && <span className="block text-xs text-slate-500">{step.why}</span>}
                            </span>
                            {!step.done && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
                        </Link>
                    </li>
                ))}
            </ol>
        </section>
    );
}
