/**
 * The isometric kit: a scene, and the three things that go in one.
 *
 * Every object is solid geometry made of painted faces — a box is a top, a
 * side and an east face rotated into a shared projection; a cylinder is a
 * stack of discs. There is no renderer, no model format and no library. The
 * whole engine is in globals.css under "The isometric engine".
 *
 * Why the kit exists rather than the markup being written out: the reference
 * build carried every face, every colour and every offset as an inline style,
 * which made a single scene about forty lines of unreadable attributes and
 * made a palette change a search-and-replace across all of them. Here a scene
 * is a list of objects with names, and `shade()` derives the darker faces from
 * the top face instead of each one being typed by hand.
 */

import type { CSSProperties, ReactNode } from "react";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/**
 * The side and east faces, derived from the top.
 *
 * Isometric solids read as solid because their faces fall away in tone. Typing
 * three hex values per object invites the kind of drift where one box is lit
 * from a different direction than its neighbour, so the two darker faces are
 * mixed from the lit one and the light direction is decided once, here.
 */
function shade(top: string, into = "#042f2e"): { fs: string; fe: string } {
    // Mixing a colour with itself returns that colour, so a box whose lit face
    // *is* the ground colour came out with three identical faces: the sides
    // were drawn, at full size, in exactly the shade of the top. A solid with
    // no edges reads as a flat silhouette, which is why the scenes looked
    // shallow — the depth was there and invisible.
    //
    // Found in the live DOM rather than the source: --ft, --fs and --fe all
    // resolved to rgb(4, 47, 46) on the hero platform.
    const toward = top.trim().toLowerCase() === into.trim().toLowerCase() ? "#000000" : into;
    return {
        fs: `color-mix(in srgb, ${top} 75%, ${toward})`,
        fe: `color-mix(in srgb, ${top} 52%, ${toward})`,
    };
}

export function IsoScene({
    size = 380,
    scale = 1,
    top = "52%",
    className = "",
    children,
}: {
    /** The platform's edge length in px, before scaling. */
    size?: number;
    scale?: number;
    top?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={`iso-scene ${className}`}
            style={{ "--p": `${size}px`, top, transform: undefined, zoom: scale } as Vars}
        >
            {children}
        </div>
    );
}

export function IsoBox({
    x,
    y,
    w,
    d,
    h,
    z = 0,
    top,
    into,
    settle,
    float,
    className = "",
    children,
}: {
    x: number;
    y: number;
    w: number;
    d: number;
    h: number;
    z?: number;
    /** The lit face. The other two are derived from it. */
    top: string;
    /** What the shaded faces mix toward. Dark ground by default. */
    into?: string;
    /** Index in the settle order, or null to be present from the start. */
    settle?: number | null;
    /** Float amplitude in px. Omit for pieces resting on the platform. */
    float?: number;
    className?: string;
    children?: ReactNode;
}) {
    const { fs, fe } = shade(top, into);
    return (
        <div
            className={`iso-box ${className}`}
            style={
                {
                    left: `${x}px`,
                    top: `${y}px`,
                    "--w": `${w}px`,
                    "--d": `${d}px`,
                    "--h": `${h}px`,
                    "--z": `${z}px`,
                    "--ft": top,
                    "--fs": fs,
                    "--fe": fe,
                    ...(float ? { "--float": `${float}px` } : {}),
                    ...(settle != null ? { "--settle": settle } : {}),
                } as Vars
            }
            data-settle={settle != null ? "" : undefined}
            data-float={float ? "" : undefined}
        >
            <div className="f t">{children}</div>
            <div className="f s" />
            <div className="f e" />
        </div>
    );
}

export function IsoCylinder({
    x,
    y,
    r,
    h,
    z = 0,
    body,
    cap,
    settle,
}: {
    x: number;
    y: number;
    r: number;
    /** Height in px. Discs are laid every 2px, so this decides how many. */
    h: number;
    z?: number;
    body: string;
    /** The lit disc on top. */
    cap: string;
    settle?: number | null;
}) {
    const discs = Math.max(1, Math.round(h / 2));
    return (
        <div
            className="iso-cyl"
            style={
                {
                    left: `${x}px`,
                    top: `${y}px`,
                    "--r": `${r}px`,
                    "--z": `${z}px`,
                    ...(settle != null ? { "--settle": settle } : {}),
                } as Vars
            }
            data-settle={settle != null ? "" : undefined}
        >
            {Array.from({ length: discs + 1 }, (_, i) => (
                <i key={i} style={{ "--i": `${i * 2}px`, background: i === discs ? cap : body } as Vars} />
            ))}
        </div>
    );
}

/** The soft blur under a floating piece. Sells the gap more than any shadow on the piece itself. */
export function IsoShade({
    x,
    y,
    w,
    h,
    z = 0,
    opacity = 0.28,
}: {
    x: number;
    y: number;
    w: number;
    h: number;
    z?: number;
    opacity?: number;
}) {
    return (
        <div
            className="iso-shade"
            style={{ left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, "--z": `${z}px`, opacity } as Vars}
        />
    );
}
