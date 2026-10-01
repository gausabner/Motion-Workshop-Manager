/**
 * The compact MOTION mark: frame, the dot that rises through its break, and
 * the `m`.
 *
 * A third variant alongside the wordmark and the lockup, and it exists for the
 * one job neither can do: a square. A tab icon, an installed app's tile, a
 * phone header with no room for seven letters — all of them want a shape that
 * reads at sixteen pixels, and a 766-wide wordmark squeezed into a square
 * reads as a smear.
 *
 * It follows the same colour rule as the lockup, for the same reason: the
 * frame carries the brand colour because it is structure, and the letterforms
 * never do. The dot is a letterform — it is the thing rising through the gap,
 * exactly as the `t` and `i` do in the full lockup — so it takes
 * `currentColor` with the `m` rather than the accent.
 */

/** The square frame, broken at the top right where the dot sits. */
const FRAME = "M16 16H152.6V30H30V226H226V30H208.6V16H240V240H16Z";

/** The dot, in the frame's gap. */
const DOT = { cx: 180.6, cy: 23, r: 20 };

const M =
    "M62 94.48L88.8 94.48L88.8 102.72C95.18 97.04 101.14 92.25 112.21 92.25C117.31 92.25 122.31 93.43 126.72 95.66C131.13 97.89 134.79 101.1 137.33 104.98C137.67 105.49 137.99 106.01 138.28 106.54L141.22 102.72C147.6 97.04 153.56 92.25 164.63 92.25C168.49 92.25 172.31 92.9 175.88 94.19C179.43 95.47 182.67 97.34 185.4 99.7C188.12 102.07 190.29 104.87 191.77 107.96C193.24 111.05 194 114.36 194 117.7L194 171.75L167.2 171.75L167.2 126.66C167.2 124.35 166.59 122.08 165.41 120.09C164.24 118.08 162.55 116.42 160.53 115.27C158.5 114.12 156.19 113.51 153.85 113.51C151.64 113.51 149.45 114.06 147.53 115.11C145.61 116.16 144.02 117.67 142.91 119.47C141.8 121.29 141.22 123.35 141.22 125.44L141.22 171.75L114.42 171.75L114.42 126.66C114.42 124.35 113.82 122.08 112.68 120.09C111.54 118.08 109.9 116.42 107.93 115.27C105.95 114.12 103.71 113.51 101.43 113.51C99.22 113.51 97.03 114.06 95.12 115.11C93.2 116.16 91.6 117.67 90.5 119.47C89.39 121.29 88.8 123.35 88.8 125.44L88.8 171.75L62 171.75Z";

export function MotionMark({
    className,
    accent,
    animated = false,
    title = "MOTION",
}: {
    className?: string;
    /** Defaults to `currentColor` so the mark works on any ground untouched. */
    accent?: string;
    /** Draws it in once. Off everywhere the mark is seen all day. */
    animated?: boolean;
    title?: string;
}) {
    return (
        <svg
            viewBox="0 0 256 256"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={title}
        >
            {/* The frame wipes in, as it does in the lockup — the same
                keyframe, so the two marks move alike when both appear. */}
            <path
                d={FRAME}
                fill={accent ?? "currentColor"}
                className={
                    animated
                        ? "motion-safe:[animation:motion-frame-in_700ms_cubic-bezier(0.23,1,0.32,1)_both]"
                        : undefined
                }
            />
            {/* The dot lands after the frame has drawn past its gap, so it
                reads as dropping into a space that was waiting for it rather
                than appearing on top of a line. */}
            <circle
                cx={DOT.cx}
                cy={DOT.cy}
                r={DOT.r}
                fill="currentColor"
                className={
                    animated
                        ? "motion-safe:origin-[70.5%_9%] motion-safe:[animation:motion-dot-in_420ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
                        : undefined
                }
                style={animated ? { animationDelay: "330ms" } : undefined}
            />
            <path
                d={M}
                fill="currentColor"
                className={
                    animated
                        ? "motion-safe:[animation:motion-letter-in_460ms_cubic-bezier(0.23,1,0.32,1)_both]"
                        : undefined
                }
                style={animated ? { animationDelay: "180ms" } : undefined}
            />
        </svg>
    );
}
