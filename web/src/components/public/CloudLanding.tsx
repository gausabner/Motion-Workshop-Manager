import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { MotionLockup, MotionLogo } from "@/components/brand/MotionLogo";
import { HeroCards } from "@/components/public/HeroCards";
import { HeroField } from "@/components/public/HeroField";
import { Reveal } from "@/components/public/Reveal";
import { CURRENCY, PLANS } from "@/lib/pricing/plans";
import { support } from "@/lib/edition";

/**
 * The hosted service's front door.
 *
 * A dark hero under a light product, which is a deliberate split rather than a
 * drift: the signed-in application is a ledger page — white, dense, hairlines,
 * no radius — and it should stay that way, because it is read at a counter all
 * day. A marketing page has one job for thirty seconds and is allowed its own
 * register, the way most software you would name does it.
 *
 * What carries across is the brand rather than the layout: the same teal, the
 * same wordmark, the same typeface, and product figures that are actually
 * MOTION's rather than a stock revenue chart.
 *
 * The competitor here is a paper day book that has not put anybody out of
 * business in fifteen years, so the page does not open by claiming to be
 * modern. It opens with the thing paper cannot do.
 *
 * Nothing above the fold is revealed on scroll. There is nothing to reveal it
 * from — it is the first frame — and hiding it until an observer fires means
 * a visitor's opening impression is an empty page for the better part of a
 * second. Reveals start below the fold, where there is genuinely an arrival.
 */

const TEAL_GLOW =
    "radial-gradient(60rem 32rem at 50% -8rem, rgba(45,212,191,0.16), transparent 70%), radial-gradient(40rem 24rem at 85% 10%, rgba(13,148,136,0.14), transparent 65%)";

function PillLink({
    href,
    children,
    variant = "solid",
}: {
    href: string;
    children: React.ReactNode;
    variant?: "solid" | "ghost";
}) {
    const base =
        "group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[15px] font-medium " +
        // Press feedback: the button takes the press rather than only changing
        // colour. Short, because it is confirming rather than explaining.
        "motion-safe:transition-[transform,background-color,border-color,box-shadow] motion-safe:duration-150 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] " +
        "active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400";
    return (
        <Link
            href={href}
            className={
                variant === "solid"
                    ? `${base} bg-teal-500 text-teal-950 shadow-lg shadow-teal-500/20 hover:bg-teal-400 hover:shadow-teal-400/30`
                    : `${base} border border-white/20 text-white hover:border-white/40 hover:bg-white/5`
            }
        >
            {children}
        </Link>
    );
}

export function CloudLanding() {
    const entry = PLANS[0];
    const reach = support();

    const spine = [
        { step: "The call", text: "A price, before anybody has committed to anything." },
        { step: "The booking", text: "A day in the diary, on the same document." },
        { step: "The job", text: "Mechanics clock on. Parts come off stock against it." },
        { step: "The invoice", text: "The same document, priced and sent by WhatsApp." },
        { step: "The money", text: "Paid, part-paid or owing — worked out, never typed." },
    ];

    const proof = [
        {
            title: "Nothing is typed twice",
            text: "One document changes type as the work moves. What you quoted is what the mechanic works from, and what they did is what the customer is billed for.",
        },
        {
            title: "The books can be proved",
            text: "Every number issued is accounted for, every deletion keeps what it said, and every export records who took it. Most workshop software cannot answer those at all.",
        },
        {
            title: "It speaks the way you do",
            text: "Invoices, quotes and approvals go out as a WhatsApp link. No app to install, no account to make, no password to forget.",
        },
        {
            title: "Your data is yours",
            text: "Every table, as a spreadsheet, whenever you ask — with a file explaining how they join. No notice period, no request form.",
        },
    ];

    return (
        <div className="flex min-h-dvh flex-col bg-white">
            {/* ── The dark half ─────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-teal-950 text-white">
                <HeroField tone="deep" />

                <header className="relative z-10">
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
                        <Link href="/" aria-label="MOTION" className="text-white">
                            <MotionLogo className="h-5 w-auto" />
                        </Link>
                        <nav className="flex items-center gap-1 sm:gap-2">
                            {[
                                ["/pricing", "Pricing"],
                                ["/help", "Help"],
                                ["/support", "Support"],
                            ].map(([href, label]) => (
                                <Link
                                    key={href}
                                    href={href}
                                    // Hidden on the narrowest screens: four items plus the
                                    // button overflowed a 375px masthead, and because the
                                    // hero clips rather than scrolls, "Sign in" went off the
                                    // edge entirely. All three are in the footer, and the
                                    // hero carries its own link to pricing.
                                    className="hidden rounded-full px-3 py-1.5 text-[13px] text-teal-100/80 motion-safe:transition-colors motion-safe:duration-150 hover:bg-white/10 hover:text-white sm:inline-block"
                                >
                                    {label}
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

                <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-14 text-center sm:pt-20">
                    <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "60ms" }}>
                        <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-400/10 px-3.5 py-1.5 text-[12px] font-medium text-teal-200">
                            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                            Built in Namibia, for Namibian workshops
                        </span>
                    </div>

                    <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "140ms" }}>
                        <h1 className="mx-auto mt-7 max-w-5xl text-[36px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[54px]">
                            Run the whole job on{" "}
                            <span className="bg-gradient-to-br from-teal-200 to-teal-400 bg-clip-text italic text-transparent">
                                one document
                            </span>
                            <br className="hidden sm:block" /> — from the call to the money.
                        </h1>
                    </div>

                    <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "230ms" }}>
                        <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-teal-100/70 sm:text-[17px]">
                            The quote becomes the job card becomes the invoice, without anybody retyping it. Licence discs, roadworthies,
                            VAT at 15 %, and WhatsApp as the way you reach a customer.
                        </p>
                    </div>

                    <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "320ms" }}>
                        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                            <PillLink href="/support">
                                Book a demo
                                <ArrowRight
                                    className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5"
                                    strokeWidth={2}
                                />
                            </PillLink>
                            <PillLink href="/pricing" variant="ghost">
                                From {CURRENCY}{entry.price?.toLocaleString("en-GB")} a month
                            </PillLink>
                        </div>
                    </div>

                    <HeroCards />
                </section>

                {/* The seam into the light half. */}
                <div aria-hidden className="h-24 bg-gradient-to-b from-transparent to-white" />
            </div>

            {/* ── The light half ────────────────────────────────────────── */}
            <main className="flex-1">
                <section className="mx-auto max-w-6xl px-5 py-16">
                    <Reveal>
                        <h2 className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            One document, start to finish
                        </h2>
                    </Reveal>
                    <ol className="mt-7 grid gap-3 sm:grid-cols-5">
                        {spine.map((stop, i) => (
                            <Reveal key={stop.step} delay={i * 60}>
                                <li className="h-full rounded-xl border border-slate-200 bg-white p-4 motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-lg hover:shadow-teal-900/5">
                                    <span className="text-[13px] font-semibold text-teal-700">{stop.step}</span>
                                    <p className="mt-1.5 text-[13px] leading-snug text-slate-600">{stop.text}</p>
                                </li>
                            </Reveal>
                        ))}
                    </ol>
                    <Reveal delay={120}>
                        <p className="mx-auto mt-6 max-w-2xl text-center text-[14px] leading-relaxed text-slate-500">
                            Most systems make you copy a quote into a job card and the job card into an invoice, and the three drift apart.
                            This is the difference you feel on the first busy Friday.
                        </p>
                    </Reveal>
                </section>

                <section className="mx-auto max-w-5xl px-5 pb-16">
                    <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2">
                        {proof.map((item, i) => (
                            <Reveal key={item.title} delay={(i % 2) * 70}>
                                <h3 className="text-[17px] font-semibold tracking-tight text-slate-900">{item.title}</h3>
                                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{item.text}</p>
                            </Reveal>
                        ))}
                    </div>
                </section>

                <section className="px-5 pb-20">
                    <Reveal>
                        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl bg-teal-950 px-8 py-12 text-center">
                            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: TEAL_GLOW }} />
                            <h2 className="relative z-10 text-[26px] font-semibold tracking-tight text-white sm:text-[32px]">See it on your own jobs</h2>
                            <p className="relative z-10 mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-teal-100/70">
                                Half an hour, on a call or at your counter. Bring a job you ran last week and we will put it through MOTION
                                in front of you.
                            </p>
                            <div className="relative z-10 mt-7 flex flex-wrap items-center justify-center gap-3">
                                <PillLink href="/support">
                                    Book a demo
                                    <ArrowRight className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
                                </PillLink>
                                {reach.whatsapp && (
                                    <a
                                        href={`https://wa.me/${reach.whatsapp.replace(/[^0-9]/g, "")}`}
                                        className="rounded-full border border-white/20 px-6 py-3 text-[15px] font-medium text-white motion-safe:transition-colors motion-safe:duration-150 hover:border-white/40 hover:bg-white/5"
                                    >
                                        WhatsApp us
                                    </a>
                                )}
                            </div>
                        </div>
                    </Reveal>
                </section>
            </main>

            <footer className="border-t border-slate-200">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-slate-500">
                    <Reveal>
                        <span className="flex items-center text-slate-900">
                            <MotionLockup className="w-52" />
                        </span>
                    </Reveal>
                    <span className="flex flex-wrap gap-5">
                        <Link href="/pricing" className="underline-offset-4 hover:text-slate-900 hover:underline">Pricing</Link>
                        <Link href="/help" className="underline-offset-4 hover:text-slate-900 hover:underline">Help</Link>
                        <Link href="/support" className="underline-offset-4 hover:text-slate-900 hover:underline">Support</Link>
                        <Link href="/terms" className="underline-offset-4 hover:text-slate-900 hover:underline">Terms</Link>
                        <Link href="/privacy" className="underline-offset-4 hover:text-slate-900 hover:underline">Privacy</Link>
                    </span>
                    <span>© {new Date().getFullYear()} MOTION Workshop Manager</span>
                </div>
            </footer>
        </div>
    );
}
