"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { topicsForPath, type Topic } from "@/lib/help";
import { Article } from "@/components/help/Article";
import { HelpSearch } from "@/components/help/HelpSearch";

/**
 * Help over the work, already on the right page.
 *
 * This is the whole reason the library exists in this shape. Somebody stuck on
 * the stocktake screen does not want a table of contents; they want the page
 * about counting, and they want it without losing the count they are halfway
 * through. So the drawer opens over the screen with that screen's topic
 * already selected, and closing it returns them to exactly what they were
 * doing.
 *
 * It is a panel rather than a route for the same reason: navigating away from
 * a half-filled job card to read about job cards is how a person loses twenty
 * minutes of work.
 */
export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const matches = topicsForPath(pathname);
    // The chosen topic remembers which screen it was chosen on. Deriving it
    // during render rather than clearing it from an effect means the panel is
    // never briefly showing help for a page the reader has already left.
    const [chosen, setChosen] = useState<{ path: string; topic: Topic } | null>(null);

    const panel = useRef<HTMLDivElement>(null);

    /**
     * What `aria-modal` promises, kept.
     *
     * Declaring a dialog modal tells a screen reader that everything behind it
     * is inert. If focus never moves in, a keyboard user presses Help and is
     * still standing on the button behind the scrim, tabbing through a page
     * they have been told is not there. So focus moves in on open, Tab cycles
     * inside the panel, the page behind stops scrolling, and the button that
     * opened it gets focus back on close.
     *
     * Focus lands on the panel itself rather than on the search field, which
     * is the obvious choice and the wrong one: on a phone, focusing a text
     * input raises the keyboard over the article somebody pressed Help in
     * order to read. Landing on the panel satisfies the modal contract, starts
     * the reader at the top of the answer, and leaves the search field one Tab
     * away for anybody who wanted it.
     */
    useEffect(() => {
        if (!open) return;
        const scrollLocked = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const focusable = () =>
            [...(panel.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ) ?? [])].filter((el) => el.offsetParent !== null);

        panel.current?.focus();

        /**
         * Tab is driven here rather than deflected at the edges.
         *
         * The usual trap only intervenes on the first and last item and lets
         * the browser handle the middle — which assumes every engine agrees
         * about what is tabbable. WebKit does not: Safari skips links on Tab
         * unless the user has turned that on, so on an iPhone the panel's
         * links are not in the native order at all, the computed first and
         * last never match, and focus walks straight out of a dialog that has
         * told the screen reader the rest of the page is inert.
         *
         * Moving focus ourselves on every Tab makes the order the same on
         * every engine, and iOS Safari is what every iPhone in these
         * workshops runs.
         */
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { onClose(); return; }
            if (e.key !== "Tab") return;
            const items = focusable();
            if (items.length === 0) return;
            e.preventDefault();
            const here = document.activeElement as HTMLElement | null;
            const at = here ? items.indexOf(here) : -1;
            const step = e.shiftKey ? -1 : 1;
            // From the panel itself, Tab enters at the top and Shift+Tab at the end.
            const next = at === -1
                ? (e.shiftKey ? items.length - 1 : 0)
                : (at + step + items.length) % items.length;
            items[next].focus();
        };

        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = scrollLocked;
            // Returning focus is the opener's job, not this component's:
            // Safari does not focus a button when it is clicked, so reading
            // document.activeElement here captures <body> on an iPhone and
            // "restores" focus to nothing.
        };
    }, [open, onClose]);

    if (!open) return null;

    const topic = (chosen?.path === pathname ? chosen.topic : null) ?? matches[0] ?? null;
    const others = matches.filter((m) => m.slug !== topic?.slug);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* The work stays visible behind it: this is a panel beside the
                task, not a place you have gone to instead. */}
            <button
                type="button"
                aria-label="Close help"
                onClick={onClose}
                className="absolute inset-0 bg-slate-900/20 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
            />

            <div
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label="Help"
                tabIndex={-1}
                className="relative flex h-full w-full max-w-md flex-col focus:outline-none border-l border-slate-200 bg-white shadow-2xl shadow-slate-900/10 motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-200 motion-safe:ease-out">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Help</span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close help"
                        className="-mr-1 flex h-8 w-8 items-center justify-center text-slate-400 hover:text-slate-900"
                    >
                        <X aria-hidden strokeWidth={1.75} className="h-4 w-4" />
                    </button>
                </div>

                <div className="border-b border-slate-200 px-4 py-3">
                    <HelpSearch />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
                    {topic ? (
                        <>
                            <Article topic={topic} compact />
                            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4">
                                <Link
                                    href={`/help/${topic.slug}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1.5 text-[12px] text-teal-700 underline-offset-4 hover:underline"
                                >
                                    Open in the manual
                                    <ExternalLink aria-hidden strokeWidth={1.75} className="h-3 w-3" />
                                </Link>
                                {others.length > 0 && (
                                    <span className="text-[12px] text-slate-500">
                                        Also on this screen:{" "}
                                        {others.map((o, i) => (
                                            <span key={o.slug}>
                                                {i > 0 && ", "}
                                                <button type="button" onClick={() => setChosen({ path: pathname, topic: o })} className="text-slate-700 underline underline-offset-4 hover:text-slate-900">
                                                    {o.title}
                                                </button>
                                            </span>
                                        ))}
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-[13px] leading-[1.65] text-slate-600">
                            <p>There is no page written for this screen yet.</p>
                            <p className="mt-3">
                                Search above, or{" "}
                                <Link href="/help" target="_blank" className="text-teal-700 underline underline-offset-4">
                                    open the manual
                                </Link>
                                .
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
