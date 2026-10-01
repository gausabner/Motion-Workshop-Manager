import Link from "next/link";
import type { ReactNode } from "react";
import { MotionLockup, MotionLogo } from "@/components/brand/MotionLogo";
import { HeroField } from "@/components/public/HeroField";
import { edition, support } from "@/lib/edition";

/**
 * The frame every public page except the landing sits in.
 *
 * It carries the landing's register rather than a second one: a dark masthead,
 * an optional dark band for the page's own title, then the content on white.
 * The seam between the two is the same gradient the landing uses, so moving
 * between them reads as one site rather than as a marketing page and then
 * some other pages somebody built later.
 *
 * What differs by edition is the masthead's offer — a price and a way to start
 * on the hosted service, nothing of the kind on a server a council has already
 * paid for.
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

export function PublicShell({
    children,
    title,
    intro,
}: {
    children: ReactNode;
    /** Shown on the dark band. Omit and the page starts straight on white. */
    title?: string;
    intro?: string;
}) {
    const cloud = edition() === "cloud";
    const nav = cloud ? NAV_CLOUD : NAV_ONPREM;
    const reach = support();

    return (
        <div className="flex min-h-dvh flex-col bg-white">
            <div className="relative overflow-hidden bg-teal-950 text-white">
                {/* The same room as the landing, stood further back. Pricing,
                    help and support are not a different site that happens to
                    share a logo — walking from the front door to the prices
                    should feel like moving through one building, and the
                    geometry is what carries that. The `lifted` tone is quieter
                    because these pages are read rather than looked at. */}
                <HeroField tone="lifted" />

                <header className="relative z-10">
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
                        <Link href="/" aria-label="MOTION" className="text-white">
                            <MotionLogo className="h-5 w-auto" />
                        </Link>
                        <nav className="flex items-center gap-1 sm:gap-2">
                            {nav.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    // Hidden on the narrowest screens for the same
                                    // reason as the landing: four items plus the
                                    // button overflow 375px, and the band clips
                                    // rather than scrolls, so "Sign in" would go
                                    // off the edge. All of them are in the footer.
                                    className="hidden rounded-full px-3 py-1.5 text-[13px] text-teal-100/80 motion-safe:transition-colors motion-safe:duration-150 hover:bg-white/10 hover:text-white sm:inline-block"
                                >
                                    {item.label}
                                </Link>
                            ))}
                            <Link
                                href="/login"
                                className="ml-1 rounded-full bg-white/10 px-4 py-1.5 text-[13px] font-medium text-white ring-1 ring-inset ring-white/15 motion-safe:transition-colors motion-safe:duration-150 hover:bg-white/20"
                            >
                                Sign in
                            </Link>
                        </nav>
                    </div>
                </header>

                {title && (
                    <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16 pt-10">
                        <h1 className="max-w-3xl text-[34px] font-semibold leading-tight tracking-[-0.02em] sm:text-[42px]">{title}</h1>
                        {intro && <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-teal-100/70">{intro}</p>}
                    </div>
                )}

                <div aria-hidden className={`bg-gradient-to-b from-transparent to-white ${title ? "h-16" : "h-10"}`} />
            </div>

            <main className="page-in flex-1">{children}</main>

            <footer className="border-t border-slate-200">
                <div className="mx-auto max-w-6xl px-5 py-10">
                    <div className="flex flex-wrap items-start justify-between gap-8">
                        <div>
                            <MotionLockup className="w-48 text-slate-900" />
                            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-slate-500">
                                Workshop management built for Namibia: the licence disc, the roadworthy, VAT at 15 %, and WhatsApp as the way
                                you reach a customer.
                            </p>
                        </div>
                        <div className="text-[13px]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reach a person</p>
                            <ul className="mt-2.5 space-y-1.5">
                                {reach.whatsapp && (
                                    <li>
                                        <a
                                            href={`https://wa.me/${reach.whatsapp.replace(/[^0-9]/g, "")}`}
                                            className="text-teal-700 underline-offset-4 hover:underline"
                                        >
                                            WhatsApp {reach.whatsapp}
                                        </a>
                                    </li>
                                )}
                                {reach.email && (
                                    <li>
                                        <a href={`mailto:${reach.email}`} className="text-teal-700 underline-offset-4 hover:underline">
                                            {reach.email}
                                        </a>
                                    </li>
                                )}
                                {reach.hours && <li className="text-slate-500">{reach.hours}</li>}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 text-[12px] text-slate-500">
                        <span>© {new Date().getFullYear()} MOTION Workshop Manager</span>
                        <span className="flex flex-wrap gap-5">
                            {cloud && <Link href="/pricing" className="underline-offset-4 hover:text-slate-900 hover:underline">Pricing</Link>}
                            <Link href="/help" className="underline-offset-4 hover:text-slate-900 hover:underline">Help</Link>
                            <Link href="/support" className="underline-offset-4 hover:text-slate-900 hover:underline">Support</Link>
                            <Link href="/terms" className="underline-offset-4 hover:text-slate-900 hover:underline">Terms</Link>
                            <Link href="/privacy" className="underline-offset-4 hover:text-slate-900 hover:underline">Privacy</Link>
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
