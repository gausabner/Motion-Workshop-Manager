"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The frame an isometric scene sits in, and the thing that decides when it
 * assembles.
 *
 * It sets `data-seen` once, from an IntersectionObserver, and then stops
 * watching. The settle choreography in globals.css is gated on that attribute,
 * so five scenes down a long page each build as they are reached rather than
 * all at once on load — and scrolling back up does not replay them. A section
 * that re-animates every time it re-enters turns a long page into a flicker,
 * which is the note already written on `Reveal` and holds just as firmly here.
 *
 * It fails open. No observer, or an observer that never fires, and `data-seen`
 * is set on the next frame anyway — the failure mode of this pattern is an
 * invisible page, so the default is visible.
 *
 * `eager` is for the hero, which is the first frame and has nothing to be
 * revealed from.
 */
export function IsoStage({
    children,
    className = "",
    height = 420,
    eager = false,
}: {
    children: ReactNode;
    className?: string;
    height?: number;
    eager?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const see = () => el.setAttribute("data-seen", "true");

        if (eager || typeof IntersectionObserver === "undefined") {
            const id = requestAnimationFrame(see);
            return () => cancelAnimationFrame(id);
        }
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                see();
                observer.disconnect();
            },
            { threshold: 0.2 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [eager]);

    return (
        <div
            ref={ref}
            aria-hidden
            className={`iso-stage relative ${className}`}
            style={{ height: `${height}px` }}
        >
            {children}
        </div>
    );
}
