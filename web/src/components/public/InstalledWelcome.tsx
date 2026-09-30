import Link from "next/link";
import { BookOpen, LifeBuoy, LogIn, Server } from "lucide-react";
import { installation, support } from "@/lib/edition";
import { PublicShell } from "@/components/public/PublicShell";

/**
 * What staff at an installed site see before they sign in.
 *
 * Not a sales page. This workshop or council already bought MOTION, probably
 * before most of the people reading this worked here, and the questions in
 * front of somebody standing at this screen are small and practical: what is
 * this, how do I use it, and who do I ring when it will not let me in.
 *
 * So the page answers those three in that order and nothing else. No price, no
 * trial, no "why MOTION" — a procurement decision does not need re-arguing to
 * the person operating the result of it.
 */
export function InstalledWelcome() {
    const install = installation();
    const reach = support();

    const doors = [
        {
            href: "/login",
            icon: LogIn,
            title: "Sign in",
            blurb: "Your workshop's own login. If you have not been given one, your administrator makes it.",
        },
        {
            href: "/help",
            icon: BookOpen,
            title: "How to use it",
            blurb: "The manual: taking a booking, raising a job card, taking a payment, counting the shelves.",
        },
        {
            href: "/support",
            icon: LifeBuoy,
            title: "Something is wrong",
            blurb: "Who to ask first, what to have ready, and how to reach us if it is a fault rather than a question.",
        },
    ];

    return (
        <PublicShell>
            <div className="mx-auto max-w-3xl px-4 py-14">
                <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-slate-900">
                    MOTION Workshop Manager
                </h1>
                <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-slate-600">
                    This copy runs on your own server. The diary, the job cards, the invoices and the parts are all here, and nothing leaves
                    this building unless somebody sends it.
                </p>

                <ul className="mt-9 divide-y divide-slate-100 border-y border-slate-200">
                    {doors.map((door) => (
                        <li key={door.href}>
                            <Link href={door.href} className="group flex items-start gap-4 py-4">
                                <door.icon aria-hidden strokeWidth={1.75} className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                                <span className="min-w-0">
                                    <span className="block text-[15px] font-medium text-slate-900 underline-offset-4 group-hover:underline">
                                        {door.title}
                                    </span>
                                    <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{door.blurb}</span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* The facts council IT asks for, on the page rather than in
                    somebody's memory. A value nobody set says so plainly. */}
                <section className="mt-10">
                    <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        <Server aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5 text-slate-400" />
                        This installation
                    </h2>
                    <dl className="mt-3 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                        {[
                            ["Installed by", install.installedBy],
                            ["Version", install.version],
                            ["Where the data is", install.dataLocation],
                            ["Your administrator", install.administrator],
                        ].map(([label, value]) => (
                            <div key={label} className="flex gap-2 border-b border-slate-100 py-1.5">
                                <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
                                <dd className={value ? "text-slate-800" : "text-slate-400"}>{value ?? "not recorded"}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                        Quote the version when you report a fault. If any of these say &ldquo;not recorded&rdquo;, whoever installed MOTION has not
                        filled them in — ask them to, because the answer being written down here is the difference between a five-minute call and
                        an afternoon.
                    </p>
                </section>

                {reach.email && (
                    <p className="mt-8 text-[13px] leading-relaxed text-slate-500">
                        Faults, upgrades and anything your administrator cannot answer:{" "}
                        <a href={`mailto:${reach.email}`} className="text-teal-700 underline underline-offset-4">{reach.email}</a>
                        {reach.hours ? ` · ${reach.hours}` : ""}.
                    </p>
                )}
            </div>
        </PublicShell>
    );
}
