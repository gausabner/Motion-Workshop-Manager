"use client";

import { useEffect, useRef } from "react";

/**
 * The depth behind the hero: a grid plane laid flat and receding to a
 * vanishing point, with a second one above it, so the page opens into a space
 * rather than onto a panel.
 *
 * It is genuinely three-dimensional — a CSS `perspective` projection, the same
 * vanishing point and the same GPU compositing a WebGL scene would use — and
 * it carries no library. That is a deliberate trade rather than a shortcut:
 * `three` with a React renderer is some six hundred kilobytes before a single
 * model is fetched, and this page is read in Windhoek on mobile data against
 * an origin measured at 380ms. A hero that takes four seconds to arrive has
 * lost the argument before it has made it.
 *
 * Everything that moves is `transform` and `opacity`. Nothing animates a
 * layout property, nothing blurs a scrolling container, and the whole field is
 * `aria-hidden` — it is atmosphere, and a screen reader should walk straight
 * past it into the headline.
 */

export type FieldTone = "deep" | "lifted";

const TONES: Record<FieldTone, { line: string; horizon: string; wash: string }> = {
    // The landing: near-black teal, the grid reading as light in a dark room.
    deep: {
        line: "rgba(45,212,191,0.34)",
        horizon:
            "radial-gradient(48rem 15rem at 50% 50%, rgba(45,212,191,0.45), transparent 70%)",
        wash: "radial-gradient(70rem 36rem at 50% -10%, rgba(45,212,191,0.14), transparent 70%)",
    },
    // Pricing and the pages under it: the same geometry, stood further back.
    // A second page should feel like the same building, not the same poster.
    lifted: {
        line: "rgba(45,212,191,0.14)",
        horizon:
            "radial-gradient(38rem 14rem at 50% 50%, rgba(45,212,191,0.18), transparent 70%)",
        wash: "radial-gradient(60rem 30rem at 50% -14%, rgba(13,148,136,0.16), transparent 72%)",
    },
};

export function HeroField({
    tone = "deep",
    className = "",
}: {
    tone?: FieldTone;
    className?: string;
}) {
    const root = useRef<HTMLDivElement>(null);

    // Parallax, on a pointer that can hover and only when motion is welcome.
    // A touch screen has no cursor to follow, and chasing `touchmove` here
    // would fight the scroll the finger is actually doing.
    useEffect(() => {
        const el = root.current;
        if (!el) return;
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        let frame = 0;
        const onMove = (e: PointerEvent) => {
            if (frame) return;
            // One write per frame. Reading clientX on every event and setting a
            // style each time is how a background like this ends up owning the
            // main thread.
            frame = requestAnimationFrame(() => {
                frame = 0;
                const x = e.clientX / window.innerWidth - 0.5;
                const y = e.clientY / window.innerHeight - 0.5;
                el.style.setProperty("--field-x", `${(x * 14).toFixed(2)}px`);
                el.style.setProperty("--field-y", `${(y * 8).toFixed(2)}px`);
            });
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        return () => {
            window.removeEventListener("pointermove", onMove);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    const t = TONES[tone];
    const grid =
        `repeating-linear-gradient(to right, ${t.line} 0 1px, transparent 1px 11%),` +
        `repeating-linear-gradient(to bottom, ${t.line} 0 1px, transparent 1px 11%)`;

    return (
        <div
            ref={root}
            aria-hidden
            className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
            style={{ ["--field-x" as string]: "0px", ["--field-y" as string]: "0px" }}
        >
            {/* The wash sits behind the geometry so the grid reads as lit by it
                rather than drawn over it. */}
            <div className="absolute inset-0" style={{ backgroundImage: t.wash }} />

            {/* The room. `perspective` here and the planes rotated inside it is
                what makes the lines converge: one vanishing point, shared. */}
            <div
                className="absolute inset-0"
                style={{
                    perspective: "60rem",
                    perspectiveOrigin: "50% 48%",
                    transform: "translate3d(var(--field-x), var(--field-y), 0)",
                    transition: "transform 600ms cubic-bezier(0.23,1,0.32,1)",
                }}
            >
                {/* Floor and ceiling. The rotation sits on the outer element
                    and the travel on the inner one, deliberately: a keyframe
                    that sets `transform` replaces the whole property, so an
                    animation carrying its own rotateX silently overrode the
                    ceiling's -84deg and rendered both planes as floors. The
                    result was a tunnel of radiating lines rather than a room.
                    Separating them means one keyframe serves both surfaces and
                    neither can clobber the other's orientation. */}
                <div
                    className="absolute left-1/2 top-[46%] h-[190vh] w-[190vw] -translate-x-1/2 origin-top"
                    style={{ transform: "rotateX(84deg)" }}
                >
                    <div
                        className="h-full w-full motion-safe:[animation:motion-field-flow_28s_linear_infinite]"
                        style={{
                            backgroundImage: grid,
                            backgroundSize: "11% 11%",
                            maskImage: "linear-gradient(to bottom, transparent 0%, #000 20%, #000 58%, transparent 92%)",
                            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 20%, #000 58%, transparent 92%)",
                        }}
                    />
                </div>

                {/* The ceiling is quieter than the floor. Two equal surfaces
                    read as a corridor; a strong floor under a faint ceiling
                    reads as a room you are standing in. */}
                <div
                    className="absolute bottom-[54%] left-1/2 h-[150vh] w-[190vw] -translate-x-1/2 origin-bottom opacity-40"
                    style={{ transform: "rotateX(-84deg)" }}
                >
                    <div
                        className="h-full w-full motion-safe:[animation:motion-field-flow_36s_linear_infinite_reverse]"
                        style={{
                            backgroundImage: grid,
                            backgroundSize: "11% 11%",
                            maskImage: "linear-gradient(to top, transparent 0%, #000 24%, #000 62%, transparent 94%)",
                            WebkitMaskImage: "linear-gradient(to top, transparent 0%, #000 24%, #000 62%, transparent 94%)",
                        }}
                    />
                </div>
            </div>

            {/* The horizon, where both planes converge. It breathes, slowly
                enough that nobody watching the page catches it doing so. */}
            <div
                className="absolute inset-x-0 top-[48%] h-[22rem] -translate-y-1/2 motion-safe:[animation:motion-field-breathe_9s_ease-in-out_infinite]"
                style={{ backgroundImage: t.horizon }}
            />

            {/* Vignette: pulls the eye back to the centre and stops the grid
                colliding with the masthead and the first content band. */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage:
                        // Light at the centre, dark at the corners — but not
                        // so dark that the geometry it is framing disappears.
                        "radial-gradient(125% 85% at 50% 46%, transparent 42%, rgba(4,47,46,0.35) 80%, rgba(4,47,46,0.8) 100%)",
                }}
            />
        </div>
    );
}
