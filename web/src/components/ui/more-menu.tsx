"use client";

import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

/**
 * The overflow at the end of a toolbar, as SAP keeps a page's rarer actions:
 * a disclosure that opens a panel of buttons, closes on Escape or a press
 * outside, and gives focus back to "More" when Escape closes it.
 */
export function MoreMenu({ label = "More", children }: { label?: string; children: React.ReactNode }) {
    const ref = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const close = (event: Event) => {
            const menu = ref.current;
            if (!menu?.open) return;
            if (event instanceof KeyboardEvent) {
                if (event.key !== "Escape") return;
                menu.open = false;
                menu.querySelector("summary")?.focus();
                return;
            }
            if (!menu.contains(event.target as Node)) menu.open = false;
        };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", close);
        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", close);
        };
    }, []);
    return (
        <details ref={ref} className="group relative">
            <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-sm border border-[var(--motion-field-edge)] bg-white px-3 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-50 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
                {label}
                <span className="sr-only"> actions</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-30 mt-1 flex w-max min-w-44 flex-col items-stretch gap-0.5 border border-slate-200 bg-white p-1 shadow-[0_10px_15px_-3px_rgb(15_23_42/0.05),0_4px_6px_-4px_rgb(15_23_42/0.05)]">
                {children}
            </div>
        </details>
    );
}
