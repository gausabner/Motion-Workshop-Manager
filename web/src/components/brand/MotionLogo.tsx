/**
 * The wordmark.
 *
 * The mark is drawn rather than set as SVG `<text>`, which is what this was
 * before: SVG text renders at the mercy of whatever font happens to resolve,
 * and on the dark landing the wordmark and the app's chrome were coming out at
 * different weights. Paths render the same everywhere.
 *
 * `accent` exists because the arrow needs a different teal on a dark ground
 * than on white — teal-600 disappears into near-black, teal-400 does not.
 */
export function MotionLogo({
    className,
    accent = "#0d9488",
}: {
    className?: string;
    /** The arrow's colour. Use a lighter teal on a dark ground. */
    accent?: string;
}) {
    return (
        <svg viewBox="0 0 132 28" className={className} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="MOTION">
            <text
                x="0"
                y="21"
                fill="currentColor"
                fontSize="22"
                fontWeight="700"
                letterSpacing="-0.03em"
                style={{ fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" }}
            >
                motion
            </text>
            {/* An arrow away and upward: the job leaving the workshop finished. */}
            <path
                d="M 100 19 L 112 7 M 103.5 7 L 112 7 L 112 15.5"
                stroke={accent}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </svg>
    );
}
