"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Where you are inside a long article.
 *
 * The marker is one hairline that moves, not a colour that changes on each
 * item in turn. That is the reading surface's single authored moment, and it
 * is authored rather than decorative: the rule slides the distance you
 * travelled, so a heading two sections down reads as further than the next one
 * even before you look at which word is lit. Everything else on this surface
 * holds still while it is being read.
 *
 * Hidden below the widest breakpoint: on a laptop the third column costs the
 * article its measure. The phone gets `ReadingProgress` instead, which is the
 * same idea with no room for a list.
 */
export function OnThisPage({ anchors }: { anchors: { id: string; text: string }[] }) {
    const [active, setActive] = useState<string | null>(anchors[0]?.id ?? null);
    const [marker, setMarker] = useState<{ top: number; height: number } | null>(null);
    const list = useRef<HTMLUListElement>(null);

    /**
     * Which heading you are under — read from scroll position, not from an
     * intersection band.
     *
     * The band version had a hole at both ends: with no heading inside it,
     * nothing fired and the indicator kept whatever it last said. Scroll back
     * to the top of an article and it still claimed you were at the bottom,
     * which is worse than having no indicator at all, because it is confidently
     * wrong. Asking "which heading did I last pass" has no such gap — every
     * scroll position has an answer, including above the first heading and
     * below the last.
     */
    useEffect(() => {
        if (anchors.length === 0) return;
        let frame = 0;

        const read = () => {
            frame = 0;
            // The line the reader's eye is on, not the top of the viewport.
            const eye = window.scrollY + 120;
            let current = anchors[0].id;
            for (const a of anchors) {
                const el = document.getElementById(a.id);
                if (el && el.offsetTop <= eye) current = a.id;
            }
            setActive(current);
        };

        const onScroll = () => { if (!frame) frame = requestAnimationFrame(read); };
        read();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [anchors]);

    // Measure where the marker should sit. Read from the DOM rather than
    // computed from an index, so a wrapped two-line entry gets a two-line rule.
    useEffect(() => {
        if (!active || !list.current) return;
        const item = list.current.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(active)}"]`);
        if (item) setMarker({ top: item.offsetTop, height: item.offsetHeight });
    }, [active, anchors]);

    if (anchors.length < 2) return null;

    return (
        <nav aria-label="On this page" className="sticky top-24">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">On this page</p>
            <div className="relative mt-2">
                {/* The rail the marker runs in. */}
                <span aria-hidden className="absolute inset-y-0 left-0 w-px bg-slate-200" />
                {marker && (
                    <span
                        aria-hidden
                        className="absolute left-0 w-px bg-teal-700 motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{ top: marker.top, height: marker.height }}
                    />
                )}
                <ul ref={list} className="space-y-px">
                    {anchors.map((a) => (
                        <li key={a.id}>
                            <a
                                href={`#${a.id}`}
                                data-anchor={a.id}
                                className={`block py-1 pl-3 text-[12px] leading-snug transition-colors ${
                                    active === a.id ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                                {a.text}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}

/**
 * The same question on a phone, where there is no room to answer it with a list.
 *
 * A hairline under the masthead showing how much of the article is behind you.
 * It exists because the phone is the named use scene — a mechanic with the
 * thing in one hand — and a long article there had no position affordance of
 * any kind: no rail, no contents, no sense of whether the answer is two
 * paragraphs away or twelve.
 *
 * Deliberately the article's own progress rather than the page's: the footer,
 * the related links and the masthead are not the thing being read, and
 * counting them would say you were finished before you were.
 *
 * It starts empty and fills, rather than crediting whatever happens to be on
 * screen at the top. Crediting the visible portion is arguably the more honest
 * measure and reads as a fault — a fifth-full bar before the reader has
 * touched anything looks like something stuck.
 */
export function ReadingProgress({ target }: { target: string }) {
    // -1 means "nothing to report": the article fits on the screen.
    const [through, setThrough] = useState(-1);

    useEffect(() => {
        const article = document.getElementById(target);
        if (!article) return;

        let frame = 0;
        const measure = () => {
            frame = 0;
            const box = article.getBoundingClientRect();
            const top = window.scrollY + box.top;
            const span = box.height - window.innerHeight;
            // An article that fits on the screen has no progress to report;
            // a bar that is always full is furniture, not information.
            if (span <= 0) { setThrough(-1); return; }
            setThrough(Math.min(1, Math.max(0, (window.scrollY - top) / span)));
        };

        const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
        measure();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [target]);

    if (through < 0) return null;

    return (
        <div aria-hidden className="pointer-events-none sticky top-0 z-10 -mt-px h-px bg-slate-200 xl:hidden">
            <div className="h-px origin-left bg-teal-700" style={{ transform: `scaleX(${through})` }} />
        </div>
    );
}
