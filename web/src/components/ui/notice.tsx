import type { ReactNode } from "react";
import { AlertTriangle, Info, type LucideIcon } from "lucide-react";

/**
 * A message that sits in the page rather than over it: a plan a feature
 * belongs to, MOTION being read-only, a link that is shown only once.
 *
 * Drawn on the Ledger Page's terms (DESIGN.md): white ground, a hairline
 * round it, and a 1px marker down the left in the tone's colour — the same
 * left-marker form the rails use for "you are here". No tinted ground: on a
 * page made of white and rules a tint reads as a different kind of object,
 * and two of them on one screen compete. Amber is kept for a state of money
 * that needs attention, as the Red Is A Verdict rule has it; everything else
 * is teal.
 */
export function Notice({
    tone = "info",
    title,
    icon,
    role,
    className = "",
    children,
}: {
    tone?: "info" | "caution";
    title?: ReactNode;
    /** Defaults to the tone's own icon; null for none. */
    icon?: LucideIcon | null;
    role?: "alert" | "status";
    className?: string;
    children?: ReactNode;
}) {
    const Icon = icon === null ? null : (icon ?? (tone === "caution" ? AlertTriangle : Info));
    return (
        <div role={role} className={`relative border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 ${className}`}>
            <span aria-hidden className={`absolute -bottom-px -left-px -top-px w-px ${tone === "caution" ? "bg-amber-600" : "bg-teal-700"}`} />
            <div className="flex gap-3">
                {Icon && <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${tone === "caution" ? "text-amber-700" : "text-teal-700"}`} strokeWidth={1.75} />}
                <div className="min-w-0 flex-1 space-y-2">
                    {title && <p className="font-semibold text-slate-900">{title}</p>}
                    {children}
                </div>
            </div>
        </div>
    );
}
