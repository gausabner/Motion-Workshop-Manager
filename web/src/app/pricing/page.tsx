import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { isCloud } from "@/lib/edition";
import { PublicShell } from "@/components/public/PublicShell";
import { ALWAYS, CARE, CURRENCY, PLANS } from "@/lib/pricing/plans";

export const metadata = {
    title: "Pricing | MOTION Workshop Manager",
    description: "What MOTION costs: from N$1,200 a month for a two-bay workshop, with councils and multi-site quoted per site.",
};

/**
 * What it costs, said plainly.
 *
 * A price nobody publishes is a price every prospect assumes is higher than it
 * is, and in this market the number doing the work is the comparison: the
 * incumbent charges roughly three to five thousand a month and its payments do
 * not work in Africa. So the figure leads and the comparison sits under it.
 *
 * There is no pricing on an installed site. Somebody whose procurement bought
 * MOTION eighteen months ago is being told they have not bought it yet.
 */
export default function PricingPage() {
    if (!isCloud()) notFound();

    return (
        <PublicShell>
            <div className="mx-auto max-w-5xl px-4 py-14">
                <div className="max-w-2xl">
                    <h1 className="text-[34px] font-semibold leading-tight tracking-tight text-slate-900">
                        What it costs
                    </h1>
                    <p className="mt-4 text-[16px] leading-relaxed text-slate-600">
                        Priced for this market rather than converted from somewhere else. Every tier includes every member of staff, and your data
                        leaves with you whenever you ask for it.
                    </p>
                </div>

                <div className="mt-10 grid gap-4 lg:grid-cols-3">
                    {PLANS.map((plan) => (
                        <section
                            key={plan.id}
                            className={`flex flex-col border bg-white p-5 ${plan.featured ? "border-teal-700" : "border-slate-200"}`}
                        >
                            <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">{plan.name}</h2>
                            <p className="mt-1 text-[13px] text-slate-500">{plan.who}</p>

                            <p className="mt-5 flex items-baseline gap-1.5">
                                {plan.price === null ? (
                                    <span className="text-[30px] font-semibold tracking-tight text-slate-900">By quote</span>
                                ) : (
                                    <>
                                        <span className="text-[15px] font-medium text-slate-500">{CURRENCY}</span>
                                        <span className="text-[34px] font-semibold tabular-nums leading-none tracking-tight text-slate-900">
                                            {plan.price.toLocaleString("en-GB")}
                                        </span>
                                    </>
                                )}
                            </p>
                            <p className="mt-1 text-[12px] text-slate-500">{plan.priceNote}</p>

                            <p className="mt-4 border-t border-slate-200 pt-4 text-[14px] leading-relaxed text-slate-700">{plan.pitch}</p>

                            <ul className="mt-4 flex-1 space-y-2">
                                {plan.includes.map((line) => (
                                    <li key={line} className="flex gap-2.5">
                                        <Check aria-hidden strokeWidth={2} className="mt-[3px] h-3.5 w-3.5 shrink-0 text-teal-700" />
                                        <span className="text-[13px] leading-snug text-slate-700">{line}</span>
                                    </li>
                                ))}
                                {plan.excludes?.map((line) => (
                                    <li key={line} className="flex gap-2.5">
                                        <Minus aria-hidden strokeWidth={2} className="mt-[3px] h-3.5 w-3.5 shrink-0 text-slate-300" />
                                        <span className="text-[13px] leading-snug text-slate-400">{line}</span>
                                    </li>
                                ))}
                            </ul>

                            <Link
                                href={plan.cta.href}
                                className={`mt-5 inline-flex items-center justify-center rounded-sm px-4 py-2 text-[14px] font-medium transition-colors ${
                                    plan.featured
                                        ? "bg-slate-900 text-white hover:bg-slate-700"
                                        : "border border-slate-300 text-slate-800 hover:bg-slate-50"
                                }`}
                            >
                                {plan.cta.label}
                            </Link>
                        </section>
                    ))}
                </div>

                <section className="mt-10 border-t border-slate-200 pt-8">
                    <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Whichever tier you are on</h2>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {ALWAYS.map((line) => (
                            <li key={line} className="flex gap-2.5">
                                <Check aria-hidden strokeWidth={2} className="mt-[3px] h-3.5 w-3.5 shrink-0 text-teal-700" />
                                <span className="text-[14px] leading-snug text-slate-700">{line}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section className="mt-8 border border-slate-200 bg-slate-50/70 px-5 py-4">
                    <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{CARE.name}</h2>
                    <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-slate-700">{CARE.pitch}</p>
                    <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-500">{CARE.note}</p>
                </section>

                <p className="mt-8 max-w-2xl text-[13px] leading-relaxed text-slate-500">
                    Prices exclude VAT and are per workshop, not per user. A workshop with two branches that keep separate books is two
                    subscriptions, because in MOTION they are two separate sets of books that cannot see each other — which is the point.
                </p>
            </div>
        </PublicShell>
    );
}
