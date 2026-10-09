import { Check, Mail, MessageCircle, Phone, BookOpen } from "lucide-react";
import { IsoScene } from "@/components/public/iso/primitives";
import { IsoStage } from "@/components/public/iso/IsoStage";
import { IsoMotion } from "@/components/public/iso/IsoMotion";
import { SupportScene } from "@/components/public/iso/scenes";
import { PublicPage, PublicBar, PublicHero, PublicFoot, SpineSection, Pill, PublicButton } from "@/components/public/frame";
import { installation, isOnPrem, support } from "@/lib/edition";
import { displayPhone } from "@/lib/messaging/phone";

export const metadata = {
    title: "Support | MOTION Workshop Manager",
    description: "How to reach a person at MOTION, what to have ready, and what counts as urgent.",
};

/**
 * How to reach a person.
 *
 * On an installed site the page sends somebody to their own administrator
 * first, and only escalates to us for faults. That is not passing the buck: a
 * forgotten password at a council is answered in thirty seconds by the person
 * down the corridor and in two days by a vendor in another town. It is also
 * the difference between a support load this business can carry at these
 * prices and one it cannot.
 *
 * "What to have ready" exists because the single most expensive thing in
 * support is the round trip that only establishes which screen somebody was
 * on. Every line on that list removes one of those.
 */
export default function SupportPage() {
    const reach = support();
    const onPrem = isOnPrem();
    const admin = installation().administrator;

    const channels = [
        reach.phone && {
            icon: Phone,
            label: "Ring",
            value: displayPhone(reach.phone) ?? reach.phone,
            href: `tel:${reach.phone.replace(/\s/g, "")}`,
            note: "For a workshop that is stopped.",
        },
        reach.whatsapp && {
            icon: MessageCircle,
            label: "WhatsApp",
            value: displayPhone(reach.whatsapp) ?? reach.whatsapp,
            href: `https://wa.me/${reach.whatsapp.replace(/[^0-9]/g, "")}`,
            note: "Send the screenshot with it. Most things are solved in one exchange.",
        },
        reach.email && {
            icon: Mail,
            label: "Email",
            value: reach.email,
            href: `mailto:${reach.email}`,
            note: "We reply within one working day.",
        },
    ].filter((c): c is NonNullable<Exclude<typeof c, false | "">> => Boolean(c));

    const ready = [
        "Which workshop, and which screen you were on.",
        "The document or receipt number, if it is about one.",
        "What you expected to happen, and what happened instead.",
        "A screenshot. It is worth more than a paragraph describing the screen.",
        onPrem ? "The version from the front page, so we know what you are running." : "Roughly when it happened.",
    ];

    return (
        <PublicPage>
            <PublicHero
                bar={<PublicBar current="/support" />}
                pill={<Pill>Reach a person</Pill>}
                title="Support"
                sub="How to reach a person, what to have ready, and what counts as urgent."
                aside="Most questions are answered faster in the help library than by waiting for a reply — it is written as the questions people actually ring about. What is not there is below."
                cta={<PublicButton href="/help">Open the help library</PublicButton>}
                figure={
                    <IsoMotion scope="header" tilt={10} drift={18}>
                        <IsoStage height={440} className="max-lg:h-[380px] max-md:h-[290px]" eager>
                            <IsoScene size={320} className="max-lg:[zoom:0.8] max-md:[zoom:0.72]">
                                <SupportScene />
                            </IsoScene>
                        </IsoStage>
                    </IsoMotion>
                }
            />

            <main>
                {onPrem && (
                    <SpineSection id="your-admin" bend="left" tint labelledBy="h-admin">
                        <h2 id="h-admin" className="max-w-[20ch] text-balance text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
                            Ask your own administrator first
                        </h2>
                        <p className="mt-4 max-w-[52ch] text-[1.0625rem] text-slate-500">
                            {admin ? (
                                <>
                                    At this site that is <span className="font-medium text-slate-900">{admin}</span>.
                                </>
                            ) : (
                                "Whoever set up the staff logins at this site."
                            )}{" "}
                            Logins, permissions and anything about how your workshop is set up are theirs to change, and they are
                            down the corridor rather than in another town.
                        </p>
                    </SpineSection>
                )}

                <SpineSection id="reach" bend={onPrem ? "right" : "left"} tint={!onPrem} labelledBy="h-reach">
                    <h2 id="h-reach" className="max-w-[20ch] text-balance text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
                        {onPrem ? "Reaching MOTION" : "Reaching us"}
                    </h2>
                    {reach.hours && (
                        <p className="mt-4 text-[1.0625rem] text-slate-500">
                            Hours: <span className="tabular-nums">{reach.hours}</span>
                        </p>
                    )}

                    {channels.length === 0 ? (
                        // Said plainly rather than shown as an empty row of
                        // cards. A support page that lists no way to reach
                        // anybody is worse than one that admits it.
                        <p className="mt-6 max-w-[52ch] rounded-2xl border-[1.5px] border-amber-500 bg-white px-5 py-4 text-[1rem] text-slate-900">
                            No contact details are configured for this installation. Whoever installed MOTION here should set them.
                        </p>
                    ) : (
                        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {channels.map((c) => (
                                <li
                                    key={c.label}
                                    className="flex flex-col items-start gap-3 rounded-[18px] border border-slate-200 bg-white p-6"
                                >
                                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-600/10 text-teal-700">
                                        <c.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                                    </span>
                                    <h3 className="mt-1 text-[1.0625rem] font-semibold text-slate-900">{c.label}</h3>
                                    <a
                                        href={c.href}
                                        className="text-base font-medium tabular-nums text-slate-900 underline decoration-teal-600 decoration-2 underline-offset-4 hover:text-teal-700"
                                    >
                                        {c.value}
                                    </a>
                                    <p className="text-[0.9375rem] text-slate-500">{c.note}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </SpineSection>

                <SpineSection id="ready" bend={onPrem ? "left" : "right"} tint={onPrem} labelledBy="h-ready">
                    <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                        <div>
                            <h2 id="h-ready" className="max-w-[20ch] text-balance text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
                                What to have ready
                            </h2>
                            <p className="mt-4 max-w-[52ch] text-[1.0625rem] text-slate-500">
                                A first message with these in it usually gets an answer instead of a question back.
                            </p>
                        </div>

                        {/* Shaped like the message it is describing — one corner
                            square, the rest rounded — so the list reads as the
                            thing you are about to send rather than as rules. */}
                        <div className="rounded-[22px] rounded-bl-md border border-slate-200 bg-white p-7 max-md:p-6">
                            <p className="mb-5 flex items-center gap-2 text-[0.875rem] text-slate-500">
                                <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                Your first message
                            </p>
                            <ul className="flex flex-col gap-4">
                                {ready.map((line) => (
                                    <li key={line} className="flex items-start gap-3 text-[1.0625rem] text-slate-900">
                                        <Check className="mt-1 h-5 w-5 shrink-0 text-teal-600" strokeWidth={1.75} aria-hidden />
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </SpineSection>

                <SpineSection id="urgent" bend={onPrem ? "right" : "left"} tint={!onPrem} label="What counts as urgent">
                    <div className="grid gap-5 lg:grid-cols-2">
                        <article className="flex flex-col items-start gap-4 rounded-[22px] border-[1.5px] border-amber-500 bg-white p-8 max-md:p-6" aria-labelledby="h-stopped">
                            <Pill tone="amber">Urgent</Pill>
                            <h3 id="h-stopped" className="text-[clamp(1.5rem,2.2vw,1.875rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
                                The workshop is stopped
                            </h3>
                            <p className="max-w-[42ch] text-[1.0625rem] text-slate-500">
                                <strong className="font-semibold text-slate-900">Cannot invoice, cannot take money, or cannot get in at all.</strong>{" "}
                                Ring rather than write, and say so in the first line.
                            </p>
                            {reach.phone && (
                                <p className="mt-auto inline-flex items-center gap-2 text-base text-slate-900">
                                    <Phone className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                    <a href={`tel:${reach.phone.replace(/\s/g, "")}`} className="tabular-nums underline decoration-teal-600 decoration-2 underline-offset-4 hover:text-teal-700">
                                        {displayPhone(reach.phone) ?? reach.phone}
                                    </a>
                                </p>
                            )}
                        </article>

                        <article className="flex flex-col items-start gap-4 rounded-[22px] border border-slate-200 bg-white p-8 max-md:p-6" aria-labelledby="h-else">
                            <h3 id="h-else" className="text-[clamp(1.5rem,2.2vw,1.875rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
                                Everything else
                            </h3>
                            <p className="max-w-[42ch] text-[1.0625rem] text-slate-500">
                                A figure that looks wrong, a report you need, or a question about how something works. We reply within
                                one working day, and many answers are already in the help library.
                            </p>
                            <div className="mt-auto">
                                <PublicButton href="/help" tone="outline">
                                    <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
                                    Open the help library
                                </PublicButton>
                            </div>
                        </article>
                    </div>
                </SpineSection>

                {/* Workshops trade on Saturdays and the office does not, so the
                    page says what that means instead of leaving a weekend
                    caller to find out. Only things a person can actually do
                    without us are listed — nothing here promises cover that
                    does not exist. */}
                <SpineSection id="after-hours" bend={onPrem ? "left" : "right"} tint={onPrem} labelledBy="h-after-hours">
                    <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                        <div>
                            <h2 id="h-after-hours" className="max-w-[20ch] text-balance text-[clamp(1.625rem,2.6vw,2.25rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-slate-900">
                                Outside office hours
                            </h2>
                            <p className="mt-4 max-w-[52ch] text-[1.0625rem] text-slate-500">
                                Workshops open on Saturdays; our office does not. Anything sent in the evening, at the weekend or on a public
                                holiday is answered first thing on the next working day — so send it now, with the screenshot, and it will be
                                first in the queue.
                            </p>
                        </div>
                        <ul className="flex flex-col gap-4">
                            {[
                                "If the workshop is stopped, mark your WhatsApp message URGENT. It is the first we deal with when the office opens.",
                                "A forgotten password is reset from the sign-in page, without waiting for us.",
                                "A member of staff who cannot sign in can be given a new password link by the workshop's owner, from Settings → Team.",
                                "Mechanics' clock-ons are recorded in the floor app even without a connection, and sent when the signal returns.",
                            ].map((line) => (
                                <li key={line} className="flex items-start gap-3 text-[1.0625rem] text-slate-900">
                                    <Check className="mt-1 h-5 w-5 shrink-0 text-teal-600" strokeWidth={1.75} aria-hidden />
                                    <span>{line}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </SpineSection>
            </main>

            <PublicFoot cta={<PublicButton href="#reach" tone="onDark">Reach a person</PublicButton>} />
        </PublicPage>
    );
}
