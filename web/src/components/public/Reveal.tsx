"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Content that arrives as it is scrolled to.
 *
 * Marketing only, and deliberately not used anywhere inside the app: content
 * somebody is trying to read or act on should not move for style, and a
 * service advisor scrolling a list of invoices does not want them fading in.
 *
 * It reveals **once** and then stops observing. A section that re-animates
 * every time it scrolls back into view turns a long page into a flicker, and
 * it is the single most common way this effect is got wrong.
 *
 * Starts from an already-visible default so a browser with JavaScript disabled,
 * or one where the observer never fires, shows the content rather than a blank
 * page — the failure mode of this pattern is invisible content, so it fails
 * open.
 */
export function Reveal({
    children,
    delay = 0,
    className = "",
}: {
    children: React.ReactNode;
    /** Milliseconds. Used to stagger siblings; keep the spread inside ~200ms. */
    delay?: number;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Reduced motion needs no branch here: every class that hides this is
        // a `motion-safe:` variant, so a reader who asked for less motion
        // never has it hidden in the first place.

        // No observer means nothing will ever reveal it, so reveal it now —
        // on a frame rather than in the effect body, which would cascade a
        // render during commit.
        if (typeof IntersectionObserver === "undefined") {
            const id = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(id);
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return;
                setShown(true);
                observer.disconnect();
            },
            // Fire a little before it reaches the fold, so the motion finishes
            // about when the reader's eye arrives rather than starting then.
            { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`motion-safe:transition-[opacity,transform] motion-safe:duration-[600ms] motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] ${
                shown ? "opacity-100 motion-safe:translate-y-0" : "motion-safe:translate-y-4 motion-safe:opacity-0"
            } ${className}`}
            style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
        >
            {children}
        </div>
    );
}
