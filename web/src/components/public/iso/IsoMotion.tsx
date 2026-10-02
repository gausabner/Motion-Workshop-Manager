"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

/**
 * The isometric scene answers the cursor.
 *
 * `.iso-scene` has carried `--tx`, `--tz`, `--sx` and `--sy` since it was
 * built, and until now nothing moved them — the projection was fixed and the
 * only motion was the settle and float keyframes. This is what steers them.
 *
 * **Why GSAP rather than the CSS transition that was there.** The transition
 * eased between whatever two values happened to land either side of it, so a
 * pointer moving continuously produced a scene permanently 1.1s behind the
 * cursor and never quite still. `gsap.quickTo` is built for this exact case:
 * one tween per property, retargeted on every event instead of recreated, so
 * the scene chases the cursor and settles rather than queueing up a backlog of
 * transitions. The transition is switched off while this is mounted, because
 * two easings on one transform is mush.
 *
 * **Only the four variables.** The 58°/−45° pair that makes the projection
 * isometric is in the stylesheet and is never touched here, so no amount of
 * pointer movement can drift the scene off its own geometry.
 *
 * It does nothing at all when the pointer is coarse — a finger has no hover,
 * and listening for pointermove on a phone means reacting to taps — or when
 * the visitor has asked for reduced motion. In both cases the scene stays
 * exactly as the stylesheet drew it, which is a complete picture rather than a
 * degraded one.
 */

export function IsoMotion({
    children,
    className = "",
    /** How far the scene rotates, in degrees, at the edge of the container. */
    tilt = 9,
    /** How far it drifts, in px, at the edge. */
    drift = 16,
    /**
     * Where the pointer is listened for, which is rarely this element.
     *
     * A scene sits in half of a hero, and somebody reading the headline never
     * moves over it — so listening only to the figure means the figure ignores
     * them. `"self"` is the figure, `"window"` is everywhere, and a selector
     * is the nearest matching ancestor, which is what the heroes want: the
     * whole band steers the object sitting in it.
     */
    scope = "self",
}: {
    children: ReactNode;
    className?: string;
    tilt?: number;
    drift?: number;
    scope?: "self" | "window" | (string & {});
}) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = ref.current;
        if (!host) return;

        const scene = host.querySelector<HTMLElement>(".iso-scene");
        if (!scene) return;

        // Both checks, every mount. A laptop with a touchscreen reports both,
        // and somebody can turn reduced motion on without reloading.
        const fine = window.matchMedia("(pointer: fine)");
        const still = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (!fine.matches || still.matches) return;

        // Hands the transform to GSAP. Without this the stylesheet's own
        // transition eases between frames GSAP is already easing between.
        scene.dataset.gsap = "on";

        const ease = { duration: 1.1, ease: "power3.out" } as const;
        const tx = gsap.quickTo(scene, "--tx", { ...ease, unit: "deg" });
        const tz = gsap.quickTo(scene, "--tz", { ...ease, unit: "deg" });
        const sx = gsap.quickTo(scene, "--sx", { ...ease, unit: "px" });
        const sy = gsap.quickTo(scene, "--sy", { ...ease, unit: "px" });

        // A selector that matches nothing falls back to the figure itself
        // rather than silently listening to the whole window, which would be a
        // scene that reacts to a cursor three sections away.
        const region: HTMLElement | null = scope === "window" || scope === "self" ? null : host.closest<HTMLElement>(scope);
        const target: HTMLElement | Window = scope === "window" ? window : (region ?? host);

        const onMove = (event: Event) => {
            const e = event as PointerEvent;
            let nx: number;
            let ny: number;
            if (scope === "window") {
                nx = e.clientX / window.innerWidth - 0.5;
                ny = e.clientY / window.innerHeight - 0.5;
            } else {
                const r = (region ?? host).getBoundingClientRect();
                if (!r.width || !r.height) return;
                nx = (e.clientX - r.left) / r.width - 0.5;
                ny = (e.clientY - r.top) / r.height - 0.5;
            }
            // Rotating about Z follows the cursor horizontally; about X it is
            // inverted, so pushing the pointer up tips the scene away rather
            // than towards — which is what reads as a physical object.
            tz(nx * tilt);
            tx(-ny * (tilt * 0.8));
            sx(nx * drift);
            sy(ny * (drift * 0.65));
        };

        // Back to rest when the cursor leaves, rather than frozen mid-tilt at
        // whatever angle it happened to exit on.
        const onLeave = () => {
            tz(0);
            tx(0);
            sx(0);
            sy(0);
        };

        target.addEventListener("pointermove", onMove, { passive: true });
        if (target !== window) (target as HTMLElement).addEventListener("pointerleave", onLeave);

        return () => {
            target.removeEventListener("pointermove", onMove);
            if (target !== window) (target as HTMLElement).removeEventListener("pointerleave", onLeave);
            // Kill the tweens before giving the transform back, or an in-flight
            // one writes to a detached node on the next frame.
            gsap.killTweensOf(scene);
            delete scene.dataset.gsap;
        };
    }, [tilt, drift, scope]);

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
}
