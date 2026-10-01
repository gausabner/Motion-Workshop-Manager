import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { MotionLockup, MotionLogo } from "@/components/brand/MotionLogo";
import { DocumentSpine } from "@/components/public/DocumentSpine";
import { IsoStage } from "@/components/public/iso/IsoStage";
import { IsoScene } from "@/components/public/iso/primitives";
import { HeroScene } from "@/components/public/iso/scenes";
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
                // Both variants are for a light ground now. The ghost used to
                // be white-on-white here: it was in the DOM, focusable, and
                // completely invisible — the worst kind of broken, because
                // nothing reports it and a keyboard user still tabs to it.
                variant === "solid"
                    ? `${base} bg-teal-600 text-white shadow-lg shadow-teal-900/15 hover:bg-teal-700 hover:shadow-teal-900/20`
                    : `${base} border border-teal-600/40 text-teal-700 hover:border-teal-600 hover:bg-teal-50`
            }
        >
            {children}
        </Link>
    );
}

export function CloudLanding() {
    const entry = PLANS[0];
    const reach = support();

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
            {/* The front door, on paper rather than in a dark room.
                The perspective field this hero used to carry still runs the
                dark surfaces — the masthead on every inner page, and the
                sign-in screen — so dark is now the frame and light is the
                content. The platform below is the same object the five stages
                stand on further down the page, which is the point: the
                document starts here and the rest of the page follows it. */}
            <header className="relative overflow-hidden bg-white">
                <div className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
                    <Link href="/" aria-label="MOTION" className="text-slate-900">
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
                                // button overflowed a 375px masthead. All three are in
                                // the footer, and the hero carries its own link to
                                // pricing.
                                className="hidden rounded-full px-3 py-1.5 text-[13px] text-slate-600 motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-100 hover:text-slate-900 sm:inline-block"
                            >
                                {label}
                            </Link>
                        ))}
                        <Link
                            href="/login"
                            className="ml-1 rounded-full bg-slate-900 px-4 py-1.5 text-[13px] font-medium text-white motion-safe:transition-colors motion-safe:duration-150 hover:bg-slate-700"
                        >
                            Sign in
                        </Link>
                    </nav>
                </div>

                <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-6 px-5 pb-32 pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:pt-4">
                    <div className="flex flex-col items-start gap-6">
                        <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "60ms" }}>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-slate-700">
                                <Sparkles className="h-3.5 w-3.5 text-teal-600" strokeWidth={2} />
                                Built in Namibia, for Namibian workshops
                            </span>
                        </div>

                        <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "140ms" }}>
                            <h1 className="max-w-[13ch] text-balance text-[40px] font-semibold leading-[1.03] tracking-[-0.04em] text-slate-900 sm:text-[clamp(2.75rem,5.4vw,4.5rem)]">
                                Run the whole job on{" "}
                                <span className="italic text-teal-700">one document</span>
                            </h1>
                        </div>

                        <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "230ms" }}>
                            <p className="max-w-[34ch] text-[17px] leading-relaxed text-slate-500 sm:text-[19px]">
                                From the call to the money — without anybody retyping it.
                            </p>
                        </div>

                        <div className="motion-safe:[animation:motion-hero-in_720ms_cubic-bezier(0.23,1,0.32,1)_both]" style={{ animationDelay: "320ms" }}>
                            <div className="flex flex-wrap items-center gap-3">
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
                    </div>

                    {/* Eager: this is the first frame. Waiting for an observer
                        here would mean the page opens on an empty half. */}
                    <IsoStage height={600} className="max-md:h-[360px]" eager>
                        <IsoScene size={380} className="max-md:[zoom:0.62]">
                            <HeroScene />
                        </IsoScene>
                    </IsoStage>
                </div>

                {/* Where the document leaves the platform and starts down the
                    page. The spine picks the line up from here. */}
                <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32">
                    <span className="absolute bottom-0 left-[50%] top-0 w-[5px] -translate-x-1/2 bg-teal-600 max-md:left-5" />
                    <span className="absolute bottom-0 left-[50%] top-0 w-5 -translate-x-1/2 rounded-t-[10px] bg-teal-600/[0.14] max-md:left-5" />
                    <span className="absolute left-[50%] top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-teal-600 bg-white max-md:left-5" />
                </div>
            </header>

            <main className="flex-1">
                {/* The five stops were a row of five small cards. They said
                    the right thing and nobody read them, because a row of
                    equal cards is a list and the claim is a journey. The spine
                    walks the same five stages down the page with the document
                    drawn travelling between them, which is the argument made
                    rather than stated. */}
                <DocumentSpine />

                <Reveal>
                    <p className="mx-auto max-w-2xl px-5 pb-16 pt-14 text-center text-[14px] leading-relaxed text-slate-500">
                        Most systems make you copy a quote into a job card and the job card into an invoice, and the three drift apart.
                        This is the difference you feel on the first busy Friday.
                    </p>
                </Reveal>

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
