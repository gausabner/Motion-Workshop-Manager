import Link from "next/link";
import { PublicShell } from "@/components/public/PublicShell";
import { CURRENCY, PLANS } from "@/lib/pricing/plans";

/**
 * The hosted service's front door.
 *
 * The competitor in this market is not other software — it is a paper day book
 * and a spreadsheet, and the workshop owner reading this has been running on
 * those for fifteen years without going out of business. So the page does not
 * open by claiming to be modern. It opens with the thing the paper cannot do:
 * carry one job from the phone call to the money without anybody typing it
 * twice.
 *
 * The price is on the page. A figure nobody publishes is assumed to be higher
 * than it is, and the comparison is doing real work here — the incumbent costs
 * three to five times this and its card payments do not work in Africa.
 */
export function CloudLanding() {
    const entry = PLANS[0];

    const spine = [
        { step: "The call", text: "A price, before anybody has committed to anything." },
        { step: "The booking", text: "A day in the diary, on the same document." },
        { step: "The job", text: "Mechanics clock on. Parts come off stock against it." },
        { step: "The invoice", text: "The same document again, priced and sent by WhatsApp." },
        { step: "The money", text: "Paid, part-paid or owing — worked out, never typed in." },
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
            title: "It speaks to your customers the way you do",
            text: "Invoices, quotes and approvals go out as a WhatsApp link. No app to install, no account for them to make, no password for them to forget.",
        },
        {
            title: "Your data is yours",
            text: "Every table, as a spreadsheet, whenever you ask — with a file explaining how they join. No notice period, no request form.",
        },
    ];

    return (
        <PublicShell>
            {/* First viewport: what it is, what it costs, and how to start. */}
            <section className="border-b border-slate-200">
                <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
                    <h1 className="max-w-3xl text-[36px] font-semibold leading-[1.15] tracking-tight text-slate-900 sm:text-[44px]">
                        Run the whole job on one document — from the phone call to the money in the bank.
                    </h1>
                    <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-slate-600">
                        MOTION is workshop management built for Namibia. The quote becomes the job card becomes the invoice, without anybody
                        retyping it. Licence discs, roadworthies, VAT at 15 %, and WhatsApp as the way you reach a customer.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-4">
                        <Link
                            href="/support"
                            className="rounded-sm bg-slate-900 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-slate-700"
                        >
                            Book a demo
                        </Link>
                        <Link href="/pricing" className="text-[15px] text-slate-700 underline underline-offset-4 hover:text-slate-900">
                            See what it costs
                        </Link>
                        <span className="text-[14px] text-slate-500">
                            From {CURRENCY}{entry.price?.toLocaleString("en-GB")} a month
                        </span>
                    </div>
                </div>
            </section>

            {/* The spine. The product's one real idea, as five stops. */}
            <section className="border-b border-slate-200 bg-slate-50/60">
                <div className="mx-auto max-w-5xl px-4 py-12">
                    <h2 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">One document, start to finish</h2>
                    <ol className="mt-4 grid gap-px overflow-hidden border border-slate-200 bg-slate-200 sm:grid-cols-5">
                        {spine.map((stop) => (
                            <li key={stop.step} className="bg-white p-4">
                                <p className="text-[14px] font-semibold text-slate-900">{stop.step}</p>
                                <p className="mt-1.5 text-[13px] leading-snug text-slate-600">{stop.text}</p>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-slate-500">
                        Most systems make you copy a quote into a job card and the job card into an invoice, and the three drift apart. This is
                        the difference you feel on the first busy Friday.
                    </p>
                </div>
            </section>

            <section className="mx-auto max-w-5xl px-4 py-12">
                <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                    {proof.map((item) => (
                        <div key={item.title}>
                            <h3 className="text-[16px] font-semibold tracking-tight text-slate-900">{item.title}</h3>
                            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{item.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="border-t border-slate-200">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-5 px-4 py-10">
                    <div>
                        <p className="text-[18px] font-semibold tracking-tight text-slate-900">See it on your own jobs</p>
                        <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-slate-600">
                            Half an hour, on a call or at your counter. Bring a job you ran last week and we will put it through MOTION in front
                            of you.
                        </p>
                    </div>
                    <Link
                        href="/support"
                        className="rounded-sm bg-slate-900 px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-slate-700"
                    >
                        Book a demo
                    </Link>
                </div>
            </section>
        </PublicShell>
    );
}
