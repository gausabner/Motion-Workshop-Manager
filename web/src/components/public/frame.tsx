import Link from "next/link";
import type { ReactNode } from "react";
import { MotionLockup } from "@/components/brand/MotionLogo";
import { edition, support } from "@/lib/edition";
import { displayPhone } from "@/lib/messaging/phone";

// Re-exported so a page can take the whole frame from one import.
export { SpineSection, Pill, PublicButton, PublicHero } from "@/components/public/spine";

/**
 * The chrome the public pages share: the bar, the hero, the banded spine and
 * the dark ground at the bottom.
 *
 * One frame rather than three. Pricing, help and support are not a different
 * site that happens to carry the same logo — walking from the front door to
 * the prices should feel like moving through one building, and the spine is
 * what carries that: a single line down the left, bending from band to band,
 * with a node where each one starts. It is the landing page's travelling
 * document, stood on its side.
 *
 * What differs by edition is what the bar offers. A council running MOTION on
 * its own server has already bought it, so there is no price to link to.
 */

const NAV_CLOUD = [
    { href: "/pricing", label: "Pricing" },
    { href: "/help", label: "Help" },
    { href: "/support", label: "Support" },
];

const NAV_ONPREM = [
    { href: "/help", label: "Help" },
    { href: "/support", label: "Support" },
];

export function PublicBar({ current }: { current?: string }) {
    const nav = edition() === "cloud" ? NAV_CLOUD : NAV_ONPREM;
    return (
        <nav
            aria-label="Primary"
            className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-[76rem] items-center justify-between gap-4 px-[var(--gut)] py-6"
        >
            <Link href="/" aria-label="MOTION, home" className="inline-flex min-h-11 items-center">
                <MotionLockup className="w-32 text-slate-900" />
            </Link>
            <div className="flex items-center gap-4 sm:gap-7">
                {nav.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={current === item.href ? "page" : undefined}
                        // Hidden below `sm`. Measured at 375px: the wordmark,
                        // three links and the Sign in pill overflow the bar by
                        // 7px, and the bar clips rather than scrolls — so the
                        // thing that goes off the edge is "Sign in", which is
                        // the one control on it that matters. Every link is in
                        // the footer, which on a phone is a short scroll away.
                        className={`hidden min-h-11 items-center text-[13px] font-medium sm:inline-flex sm:text-[14px] ${
                            current === item.href
                                ? "text-teal-700 underline decoration-2 underline-offset-[7px]"
                                : "text-slate-900 hover:text-teal-700"
                        }`}
                    >
                        {item.label}
                    </Link>
                ))}
                <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-slate-200 px-3 text-[13px] font-medium text-slate-900 hover:border-teal-600 sm:px-[1.1rem] sm:text-[14px]"
                >
                    Sign in
                </Link>
            </div>
        </nav>
    );
}

/**
 * The ground the page lands on.
 *
 * Dark, because the line has to stop somewhere and a page that simply runs out
 * of white reads as unfinished. The spine arrives, widens into a node, and
 * that is the end of the document's journey.
 */
export function PublicFoot({ cta }: { cta?: ReactNode }) {
    const reach = support();
    const cloud = edition() === "cloud";
    return (
        <footer className="relative bg-teal-950 px-0 pb-10 pt-36 text-white">
            <span aria-hidden className="absolute left-[var(--spx)] top-0 h-20 w-[5px] -translate-x-1/2 bg-teal-400">
                <span className="absolute inset-y-0 left-1/2 w-5 -translate-x-1/2 rounded-b-[10px] bg-teal-400/[0.14]" />
            </span>
            <span
                aria-hidden
                className="absolute left-[var(--spx)] top-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-400 shadow-[0_0_0_7px_rgba(45,212,191,0.18)]"
            />

            <div className="mx-auto max-w-[76rem] px-[var(--gut)]">
                <div className="flex flex-col gap-9 pl-[var(--indent)]">
                    <p className="max-w-[34ch] text-[clamp(1.25rem,2.2vw,1.75rem)] font-medium leading-[1.3] tracking-[-0.015em]">
                        Workshop management built for Namibia: the licence disc, the roadworthy, VAT at{" "}
                        <span className="tabular-nums">15%</span>, and WhatsApp as the way you reach a customer.
                    </p>

                    {cta}

                    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-teal-400/25 pt-5 text-[14px]">
                        <ul className="flex flex-wrap gap-x-6">
                            {[
                                ...(cloud ? [["/pricing", "Pricing"] as const] : []),
                                ["/help", "Help"] as const,
                                ["/support", "Support"] as const,
                                ["/terms", "Terms"] as const,
                                ["/privacy", "Privacy"] as const,
                            ].map(([href, label]) => (
                                <li key={href}>
                                    <Link href={href} className="inline-flex min-h-11 items-center hover:text-teal-400">
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <small className="text-[13px] text-white/70">
                            © <span className="tabular-nums">{new Date().getFullYear()}</span> MOTION Workshop Manager
                        </small>
                    </div>

                    {/* Kept from the shell this replaces. A council's procurement
                        asks how a supplier is reached, and burying it in a link
                        to another page is the answer nobody wants. */}
                    {(reach.whatsapp || reach.email) && (
                        <p className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-white/70">
                            {reach.whatsapp && (
                                <a href={`https://wa.me/${reach.whatsapp.replace(/[^0-9]/g, "")}`} className="hover:text-teal-400">
                                    WhatsApp {displayPhone(reach.whatsapp)}
                                </a>
                            )}
                            {reach.email && (
                                <a href={`mailto:${reach.email}`} className="hover:text-teal-400">
                                    {reach.email}
                                </a>
                            )}
                            {reach.hours && <span>{reach.hours}</span>}
                        </p>
                    )}
                </div>
            </div>
        </footer>
    );
}

/** The outer wrapper that defines `--spx` for everything inside it. */
export function PublicPage({ children }: { children: ReactNode }) {
    return <div className="pub flex min-h-dvh flex-col overflow-x-clip bg-white">{children}</div>;
}
