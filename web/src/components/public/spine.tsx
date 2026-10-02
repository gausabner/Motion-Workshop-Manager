import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The parts of the public frame that are only markup.
 *
 * Split from `frame.tsx` because that file reaches `lib/edition`, which is
 * `server-only` — so a client component that wanted a spine section or a
 * button would drag a server import into the browser bundle and fail the
 * build. The help index needs exactly that: its topic finder filters as you
 * type, so the sections it filters have to be rendered from the client.
 *
 * Nothing here reads the environment or the request. That is the rule that
 * keeps the split honest.
 */

/** The two bends, alternating, so the line leans away from the content and back. */
const SEG_LEFT = "M50 0 C50 32 22 28 22 50 C22 72 50 68 50 100";
const SEG_RIGHT = "M50 0 C50 32 78 28 78 50 C78 72 50 68 50 100";

/**
 * One band of a public page, with its piece of spine.
 *
 * Two copies of the same path: the grey one is the road ahead, the teal one is
 * how far the reader has come. The fill is clipped on a scroll timeline in
 * `globals.css`, so the main thread never sees it.
 */
export function SpineSection({
    id,
    bend = "left",
    tint = false,
    label,
    labelledBy,
    children,
}: {
    id?: string;
    bend?: "left" | "right";
    tint?: boolean;
    label?: string;
    labelledBy?: string;
    children: ReactNode;
}) {
    const d = bend === "left" ? SEG_LEFT : SEG_RIGHT;
    return (
        <section
            id={id}
            aria-label={label}
            aria-labelledby={labelledBy}
            className={`relative scroll-mt-4 py-24 max-md:py-[5.5rem] ${tint ? "bg-slate-100" : "bg-white"}`}
        >
            <Seg d={d} />
            <Seg d={d} fill />
            <span
                aria-hidden
                className="absolute left-[var(--spx)] top-0 z-[3] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-teal-600 bg-white"
            />
            <div className="mx-auto max-w-[76rem] px-[var(--gut)]">
                <div className="relative z-[2] pl-[var(--indent)]">{children}</div>
            </div>
        </section>
    );
}

function Seg({ d, fill = false }: { d: string; fill?: boolean }) {
    return (
        <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className={`pub-seg pointer-events-none absolute inset-y-0 left-[var(--spx)] z-[1] h-full w-12 -translate-x-1/2 overflow-visible ${
                fill ? "pub-seg-fill" : ""
            }`}
        >
            {fill ? (
                <>
                    <path d={d} stroke="rgba(13,148,136,0.14)" strokeWidth={20} />
                    <path d={d} stroke="#0d9488" strokeWidth={5} />
                </>
            ) : (
                <path d={d} stroke="#e2e8f0" strokeWidth={5} />
            )}
        </svg>
    );
}

/** The pill the heroes open with. */
export function Pill({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "amber" }) {
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full border bg-white px-[0.8rem] py-[0.4rem] text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-slate-900 ${
                tone === "amber" ? "border-amber-500" : "border-slate-200"
            }`}
        >
            <i aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone === "amber" ? "bg-amber-500" : "bg-teal-600"}`} />
            {children}
        </span>
    );
}

/** The two button shapes the public pages use. */
export function PublicButton({
    href,
    children,
    tone = "solid",
}: {
    href: string;
    children: ReactNode;
    tone?: "solid" | "outline" | "onDark";
}) {
    const base =
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] px-6 text-base font-semibold " +
        "motion-safe:transition-transform motion-safe:duration-300 hover:-translate-y-0.5";
    const tones = {
        solid: "border-teal-600 bg-teal-600 text-white",
        outline: "border-teal-600 text-teal-700",
        onDark: "self-start border-teal-400 text-white",
    };
    return (
        <Link href={href} className={`${base} ${tones[tone]}`}>
            {children}
        </Link>
    );
}

/**
 * The first band. Copy on the left, an object on the right.
 *
 * `lead` is the stub of spine dropping out of the bottom, which the first
 * section then picks up. Without it the line appears from nowhere half way
 * down the page.
 */
export function PublicHero({
    bar,
    pill,
    title,
    sub,
    aside,
    cta,
    figure,
}: {
    /**
     * The navigation band, passed in rather than rendered here.
     *
     * `PublicBar` reads the edition, which is `server-only`. The help index is
     * a client component — its finder filters as you type — so it cannot build
     * its own bar, but it can be handed one a server component already made.
     */
    bar: ReactNode;
    pill?: ReactNode;
    title: string;
    sub?: string;
    aside?: string;
    cta?: ReactNode;
    figure?: ReactNode;
}) {
    return (
        <header className="relative overflow-hidden pb-36 pt-[8.5rem] max-md:pb-28 max-md:pt-[6.5rem]">
            {bar}

            <div className="mx-auto grid max-w-[76rem] items-center gap-8 px-[var(--gut)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col items-start gap-[1.4rem]">
                    {pill}
                    <h1 className="max-w-[14ch] text-balance text-[clamp(2.5rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-slate-900">
                        {title}
                    </h1>
                    {sub && <p className="max-w-[40ch] text-[clamp(1.0625rem,1.5vw,1.25rem)] text-slate-500">{sub}</p>}
                    {aside && <p className="max-w-[46ch] text-[0.975rem] text-slate-500">{aside}</p>}
                    {cta && <div className="mt-1 flex flex-wrap gap-3">{cta}</div>}
                </div>
                {figure}
            </div>

            {/* The line leaving the hero. `--spx` puts it where the sections
                below will pick it up, so the two read as one line rather than
                two that happen to be the same colour. */}
            <span aria-hidden className="pointer-events-none absolute bottom-0 left-[var(--spx)] h-24 w-0">
                <span className="absolute inset-y-0 left-0 w-[5px] -translate-x-1/2 bg-teal-600">
                    <span className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 rounded-t-[10px] bg-teal-600/[0.14]" />
                </span>
                <span className="absolute left-0 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-teal-600 bg-white" />
            </span>
        </header>
    );
}
