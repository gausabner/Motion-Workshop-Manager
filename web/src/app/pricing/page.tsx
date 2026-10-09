import { Check, Minus, ArrowDownToLine, Users, MapPin, CalendarDays } from "lucide-react";
import { IsoScene } from "@/components/public/iso/primitives";
import { IsoStage } from "@/components/public/iso/IsoStage";
import { IsoMotion } from "@/components/public/iso/IsoMotion";
import { PricingScene, MigrationScene } from "@/components/public/iso/scenes";
import { PublicPage, PublicBar, PublicHero, PublicFoot, SpineSection, Pill, PublicButton } from "@/components/public/frame";
import { ALWAYS, CARE, PLANS, VAT_RATE, withVat } from "@/lib/pricing/plans";
import { money } from "@/lib/format";

export const metadata = {
    title: "Pricing | MOTION Workshop Manager",
    description:
        "What MOTION costs: from N$ 1,200.00 a month, excluding VAT, for a two-bay workshop, with councils and multi-site quoted per site.",
};

/**
 * What it costs, said out loud.
 *
 * A price nobody publishes is a price every prospect assumes is higher than it
 * is. The incumbent charges roughly three to five thousand a month and its
 * payments do not work in Africa; a workshop quoted N$1,200 against that is
 * being told something useful, and a workshop that has to ring to find out is
 * being told they have not bought it yet.
 *
 * Both figures appear on every priced tier. The headline is exclusive of VAT,
 * which is the convention this business already uses on its own quotations and
 * the way other VAT-registered businesses read a price — but the amount that
 * leaves the bank is underneath it, computed rather than typed, because a
 * customer meeting the 15 % for the first time at the bank is a complaint.
 */
export default function PricingPage() {
    return (
        <PublicPage>
            <PublicHero
                bar={<PublicBar current="/pricing" />}
                pill={<Pill>Pricing</Pill>}
                title="What it costs"
                sub="Priced for this market rather than converted from somewhere else. Every tier includes every member of staff, and your data leaves with you whenever you ask for it."
                cta={
                    // The paid path beside the assisted one. Registering works end
                    // to end — plan, reference, payment, activation — and for a
                    // long time no page led to it.
                    <>
                        <PublicButton href="/register">Register your workshop</PublicButton>
                        <PublicButton href="/support" tone="outline">
                            Book a demonstration
                        </PublicButton>
                    </>
                }
                figure={
                    <IsoMotion scope="header" tilt={11} drift={20}>
                        <IsoStage height={440} className="max-lg:h-[380px] max-md:h-[290px]" eager>
                            <IsoScene size={340} className="max-lg:[zoom:0.8] max-md:[zoom:0.72]">
                                <PricingScene />
                            </IsoScene>
                        </IsoStage>
                    </IsoMotion>
                }
            />

            <main>
                <SpineSection id="tiers" bend="left" labelledBy="h-tiers">
                    <h2 id="h-tiers" className="sr-only">
                        Tiers
                    </h2>
                    <Tiers />
                </SpineSection>

                <SpineSection id="always" bend="right" tint labelledBy="h-always">
                    <h2
                        id="h-always"
                        className="max-w-[20ch] text-balance text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900"
                    >
                        Whichever tier you are on
                    </h2>
                    <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                        {ALWAYS.map((line, i) => {
                            const Icon = [ArrowDownToLine, Users, MapPin, CalendarDays][i] ?? Check;
                            // Each line is "Headline. The rest." — split on the
                            // first full stop so the promise reads before the
                            // qualification, rather than as one grey paragraph.
                            const [head, ...rest] = line.split(". ");
                            return (
                                <li key={line} className="flex flex-col items-start gap-4">
                                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600/10 text-teal-700">
                                        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                                    </span>
                                    <p className="max-w-[30ch] text-[0.975rem] text-slate-500">
                                        {/* Stripped first, so a line with no break in it cannot end ".." again. */}
                                        <strong className="mb-1 block text-[1.0625rem] font-semibold text-slate-900">{head.replace(/\.$/, "")}.</strong>
                                        {rest.join(". ")}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                </SpineSection>

                <SpineSection id="start" bend="left" labelledBy="h-start">
                    <div className="grid items-center gap-12 lg:grid-cols-2">
                        <div className="flex flex-col items-start gap-4">
                            <h2
                                id="h-start"
                                className="max-w-[20ch] text-balance text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900"
                            >
                                {CARE.name}
                            </h2>
                            <p className="max-w-[34ch] text-[1.25rem] font-medium leading-[1.4] tracking-[-0.01em] text-slate-900">
                                {CARE.pitch}
                            </p>
                            <p className="max-w-[52ch] text-[1.0625rem] text-slate-500">{CARE.note}</p>
                            <p className="mt-2 max-w-[52ch] rounded-2xl border border-slate-200 px-5 py-4 text-[0.875rem] text-slate-500">
                                Prices exclude VAT and are per workshop, not per user. A workshop with two branches that keep separate
                                books is two subscriptions, because in MOTION they are two separate sets of books that cannot see each
                                other — which is the point.
                            </p>
                        </div>
                        <IsoMotion scope="section" tilt={6} drift={10}>
                            <IsoStage height={360} className="max-md:h-[300px]">
                                <IsoScene size={260} scale={1.1} className="max-md:[zoom:0.84]">
                                    <MigrationScene />
                                </IsoScene>
                            </IsoStage>
                        </IsoMotion>
                    </div>
                </SpineSection>
            </main>

            <PublicFoot
                cta={
                    <div className="flex flex-wrap gap-3">
                        <PublicButton href="/register">Register your workshop</PublicButton>
                        <PublicButton href="/support" tone="onDark">
                            Book a demonstration
                        </PublicButton>
                    </div>
                }
            />
        </PublicPage>
    );
}

/**
 * The three tiers, joined by an arch.
 *
 * `lg:grid-rows-[subgrid]` is what keeps the price, the summary and the button
 * on the same line across all three cards however long the names and sentences
 * are. Without it each card lays itself out and the three prices sit at three
 * different heights, which is exactly where the eye needs to compare.
 */
function Tiers() {
    return (
        <div className="relative lg:pt-10">
            {/* The spine arching over the three, so they read as three stops on
                one line rather than three separate offers. Hidden below lg,
                where the cards stack and an arch across a single column would
                be drawing a connection that is not there. */}
            <svg
                aria-hidden
                viewBox="0 0 400 40"
                preserveAspectRatio="none"
                className="pointer-events-none absolute left-[16.666%] top-0 hidden h-10 w-[66.666%] overflow-visible lg:block"
            >
                <path d="M0 40 C67 0 133 0 200 40 C267 0 333 0 400 40" fill="none" stroke="rgba(13,148,136,0.14)" strokeWidth={16} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d="M0 40 C67 0 133 0 200 40 C267 0 333 0 400 40" fill="none" stroke="#0d9488" strokeWidth={4} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>

            <ul className="grid gap-5 lg:grid-cols-3 lg:grid-rows-[repeat(5,auto)] lg:gap-x-5 lg:gap-y-0">
                {PLANS.map((plan) => {
                    const dark = plan.price === null;
                    return (
                        <li
                            key={plan.id}
                            className={`relative flex flex-col gap-[1.1rem] rounded-[22px] border p-7 max-md:p-6 lg:row-span-5 lg:grid lg:grid-rows-[subgrid] lg:content-start ${
                                dark ? "border-teal-950 bg-teal-950 text-white" : "border-slate-200 bg-white"
                            }`}
                        >
                            <span
                                aria-hidden
                                className="absolute left-1/2 top-0 z-[2] hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-teal-600 bg-white lg:block"
                            />

                            <h3 className="text-[1.25rem] font-semibold tracking-[-0.01em]">{plan.name}</h3>

                            <p className="flex flex-col gap-1.5">
                                <span className="text-[clamp(2.25rem,3.4vw,2.75rem)] font-medium leading-none tracking-[-0.03em] tabular-nums">
                                    {plan.price === null ? "By quote" : money(plan.price)}
                                </span>
                                <span className={`text-[0.9rem] ${dark ? "text-white/[0.78]" : "text-slate-500"}`}>{plan.priceNote}</span>
                                {/* What actually leaves the bank account. Derived
                                    from the figure above rather than written
                                    beside it, so the two cannot drift apart. */}
                                {plan.price !== null && (
                                    <span className="text-[0.9rem] text-slate-500">
                                        {money(withVat(plan.price))} including VAT at {VAT_RATE}%
                                    </span>
                                )}
                            </p>

                            <p className={`max-w-[34ch] text-base ${dark ? "text-white/[0.78]" : "text-slate-700"}`}>{plan.pitch}</p>

                            <div className="self-start justify-self-start">
                                <PublicButton href={plan.cta.href} tone={dark ? "onDark" : "solid"}>
                                    {plan.cta.label}
                                </PublicButton>
                            </div>

                            <ul
                                className={`mt-1.5 flex flex-col gap-3 border-t pt-5 text-[0.9375rem] ${
                                    dark ? "border-teal-400/[0.28]" : "border-slate-200"
                                }`}
                            >
                                {plan.includes.map((line, i) => (
                                    <li key={line} className={`flex items-start gap-2.5 ${i === 0 && line.startsWith("Everything") ? "font-semibold" : ""}`}>
                                        <Check
                                            aria-hidden
                                            className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${dark ? "text-teal-400" : "text-teal-600"}`}
                                            strokeWidth={1.75}
                                        />
                                        <span>{line}</span>
                                    </li>
                                ))}
                                {plan.excludes?.map((line) => (
                                    <li key={line} className="flex items-start gap-2.5 text-slate-500">
                                        <Minus aria-hidden className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                                        <span>
                                            <span className="sr-only">Not included: </span>
                                            {line}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
