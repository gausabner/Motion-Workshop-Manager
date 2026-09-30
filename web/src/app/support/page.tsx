import Link from "next/link";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { installation, isOnPrem, support } from "@/lib/edition";
import { PublicShell } from "@/components/public/PublicShell";

export const metadata = {
    title: "Support | MOTION Workshop Manager",
    description: "How to reach MOTION, what to have ready, and what counts as urgent.",
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
 * support is the round trip that only establishes which screen somebody was on.
 */
export default function SupportPage() {
    const reach = support();
    const onPrem = isOnPrem();
    const admin = installation().administrator;

    const channels = [
        reach.whatsapp ? {
            icon: MessageCircle,
            label: "WhatsApp",
            value: reach.whatsapp,
            href: `https://wa.me/${reach.whatsapp.replace(/[^0-9]/g, "")}`,
            note: "Fastest. Send a screenshot with it.",
        } : null,
        reach.email ? {
            icon: Mail,
            label: "Email",
            value: reach.email,
            href: `mailto:${reach.email}`,
            note: "Best for anything with detail, or where you want a record.",
        } : null,
        reach.phone ? {
            icon: Phone,
            label: "Phone",
            value: reach.phone,
            href: `tel:${reach.phone.replace(/\s/g, "")}`,
            note: "When the workshop is stopped and typing is not on.",
        } : null,
    ].filter((c): c is NonNullable<typeof c> => Boolean(c));

    return (
        <PublicShell
            title="Support"
            intro="How to reach a person, what to have ready, and what counts as urgent."
        >
            <div className="mx-auto max-w-3xl px-5 pb-16">
                <p className="-mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600">
                    Most questions are answered faster in{" "}
                    <Link href="/help" className="text-teal-700 underline underline-offset-4">the help library</Link> than by waiting for a
                    reply — it is written as the questions people actually ring about. What is not there is below.
                </p>

                {onPrem && (
                    <section className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4">
                        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">Ask your own administrator first</h2>
                        <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">
                            {admin ? <>At this site that is <span className="font-medium text-slate-900">{admin}</span>.</> : "Whoever set up the staff logins at this site."}{" "}
                            Passwords, who can see what, adding somebody, changing a tax rate and getting your logo onto an invoice are all things
                            they can do in minutes and we cannot do at all without them.
                        </p>
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                            Come to us when MOTION itself is wrong: a figure that does not add up, a page that will not load, an upgrade, or a
                            question your administrator cannot answer.
                        </p>
                    </section>
                )}

                <section className="mt-9">
                    <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {onPrem ? "Reaching MOTION" : "Reaching us"}
                    </h2>
                    {channels.length === 0 ? (
                        <p className="mt-3 border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] text-slate-800">
                            No support channels are configured for this deployment. Whoever installed MOTION needs to set
                            <code className="mx-1 rounded bg-white px-1 text-[13px]">MOTION_SUPPORT_EMAIL</code>
                            and the other contact values.
                        </p>
                    ) : (
                        <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-200">
                            {channels.map((c) => (
                                <li key={c.label} className="flex items-start gap-4 py-3.5">
                                    <c.icon aria-hidden strokeWidth={1.75} className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                                    <div className="min-w-0">
                                        <a href={c.href} className="text-[15px] font-medium text-teal-700 underline-offset-4 hover:underline">
                                            {c.value}
                                        </a>
                                        <p className="mt-0.5 text-[13px] text-slate-500">{c.note}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {reach.hours && <p className="mt-3 text-[13px] text-slate-500">{reach.hours}</p>}
                </section>

                <section className="mt-9">
                    <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">What to have ready</h2>
                    <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                        A first message with these in it usually gets an answer instead of a question back.
                    </p>
                    <ul className="mt-3 space-y-2">
                        {[
                            "Which workshop, and which screen you were on.",
                            "The document or receipt number, if it is about one.",
                            "What you expected to happen, and what happened instead.",
                            "A screenshot. It is worth more than a paragraph describing the screen.",
                            onPrem ? "The version from the front page, so we know what you are running." : "Roughly when it happened.",
                        ].map((line) => (
                            <li key={line} className="flex gap-3">
                                <span aria-hidden className="mt-[0.7em] h-px w-2.5 shrink-0 bg-slate-300" />
                                <span className="text-[14px] leading-relaxed text-slate-700">{line}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mt-9 border-t border-slate-200 pt-6">
                    <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">What counts as urgent</h2>
                    <p className="mt-2 text-[14px] leading-relaxed text-slate-700">
                        The workshop cannot invoice, cannot take money, or cannot get in at all. Say so in the first line and ring rather than
                        write. Everything else — a figure that looks wrong, a report you want, a question about how something works — is answered
                        in hours rather than minutes, and honestly most of it is in the help library already.
                    </p>
                </section>
            </div>
        </PublicShell>
    );
}
