import Link from "next/link";
import type { ReactNode } from "react";
import { edition, support } from "@/lib/edition";

/**
 * The frame around everything a signed-out visitor sees.
 *
 * Written once for both editions because almost all of it is the same: a
 * masthead, a way in, and a foot that says how to reach a person. What differs
 * is what the masthead offers — a price and a way to start on the hosted
 * service, nothing of the kind on a server a council already paid for.
 */

const NAV_CLOUD = [
    { href: "/pricing", label: "Pricing" },
    { href: "/help", label: "Help" },
    { href: "/support", label: "Support" },
];

// No "this installation" entry: those facts are on the front page, which the
// masthead already returns to. A second page carrying the same four rows is
// the duplication that makes people stop trusting either copy.
const NAV_ONPREM = [
    { href: "/help", label: "Help" },
    { href: "/support", label: "Support" },
];

export function PublicShell({ children }: { children: ReactNode }) {
    const cloud = edition() === "cloud";
    const nav = cloud ? NAV_CLOUD : NAV_ONPREM;
    const reach = support();

    return (
        <div className="flex min-h-dvh flex-col bg-white">
            <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
                    <Link href="/" className="text-[15px] font-semibold tracking-tight text-slate-900">
                        MOTION
                    </Link>
                    {/* The links stay on a phone. Most people arrive here from a
                        WhatsApp link on a handset, and a masthead offering
                        nothing but "Sign in" to somebody who has not bought
                        anything yet is a dead end. They fit at this size. */}
                    <nav className="flex items-center gap-4 sm:gap-5">
                        {nav.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="text-[13px] text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            href="/login"
                            className="rounded-sm bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-slate-700"
                        >
                            Sign in
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="page-in flex-1">{children}</main>

            <footer className="border-t border-slate-200">
                <div className="mx-auto max-w-5xl px-4 py-8">
                    <div className="flex flex-wrap items-start justify-between gap-6">
                        <div>
                            <p className="text-[14px] font-semibold tracking-tight text-slate-900">MOTION Workshop Manager</p>
                            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-slate-500">
                                Workshop management built for Namibia: the licence disc, the roadworthy, VAT at 15 %, and WhatsApp as the way you
                                reach a customer.
                            </p>
                        </div>
                        <div className="text-[13px]">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Reach a person</p>
                            <ul className="mt-2 space-y-1">
                                {reach.whatsapp && (
                                    <li>
                                        <a href={`https://wa.me/${reach.whatsapp.replace(/[^0-9]/g, "")}`} className="text-teal-700 underline-offset-4 hover:underline">
                                            WhatsApp {reach.whatsapp}
                                        </a>
                                    </li>
                                )}
                                {reach.phone && reach.phone !== reach.whatsapp && (
                                    <li><a href={`tel:${reach.phone.replace(/\s/g, "")}`} className="text-slate-700 hover:text-slate-900">{reach.phone}</a></li>
                                )}
                                {reach.email && (
                                    <li><a href={`mailto:${reach.email}`} className="text-teal-700 underline-offset-4 hover:underline">{reach.email}</a></li>
                                )}
                                {reach.hours && <li className="text-slate-500">{reach.hours}</li>}
                            </ul>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-[12px] text-slate-500">
                        <span>© {new Date().getFullYear()} MOTION Workshop Manager</span>
                        <span className="flex gap-4">
                            <Link href="/terms" className="underline-offset-4 hover:text-slate-900 hover:underline">Terms</Link>
                            <Link href="/privacy" className="underline-offset-4 hover:text-slate-900 hover:underline">Privacy</Link>
                            <Link href="/support" className="underline-offset-4 hover:text-slate-900 hover:underline">Support</Link>
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    );
}
