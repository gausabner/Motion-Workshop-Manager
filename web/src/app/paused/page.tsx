import { redirect } from "next/navigation";
import Link from "next/link";
import { PauseCircle } from "lucide-react";
import { ACCENT_ON_DARK, MotionLockup } from "@/components/brand/MotionLogo";
import { HeroField } from "@/components/public/HeroField";
import { PaymentDetails } from "@/app/activate/PaymentDetails";
import { requireUser, signedInLanding } from "@/lib/auth/session";
import { paymentSummary, suspendedWorkshopFor } from "@/lib/billing/registration";
import { bankDetails } from "@/lib/billing/config";
import { support } from "@/lib/edition";
import { logoutAction } from "@/lib/auth/actions";

export const metadata = {
    title: "Access paused | MOTION Workshop Manager",
    robots: { index: false, follow: false },
};

/**
 * Where everybody in a suspended workshop lands.
 *
 * Suspension is MOTION pausing access — almost always for a payment that has
 * not arrived — and nothing more. The workshop's records are untouched, and
 * the page leads with that, because it is the first thing an owner locked out
 * of their own jobs and invoices wants to know. Then it gives them what they
 * need to end it themselves: the amount, the bank and the reference, the same
 * as on the day they registered.
 *
 * Outside `/[tenant]` for the same reason `/activate` is: `requireTenant` is
 * what sends people here, so a tenant route would loop.
 */
export default async function PausedPage() {
    const user = await requireUser("/paused");
    const paused = await suspendedWorkshopFor(user.id);
    // Switched back on since they bookmarked this, or never paused at all.
    if (!paused) redirect(await signedInLanding(user.id));

    const bank = bankDetails();
    const sub = paused.subscription;
    const reach = support().email;
    const intro = (
        <>
            Access to <span className="font-medium text-slate-900">{paused.workshopName}</span> is paused because your
            subscription payment has not been received. <span className="font-medium text-slate-900">Nothing has been deleted</span>:
            your customers, vehicles, jobs, quotes and invoices are kept as they were.
            {sub && bank ? " Pay the amount below and we will restore access and confirm by email." : ""}
        </>
    );

    return (
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-teal-950 p-6">
            <HeroField tone="deep" />

            <div className="relative z-10 w-full max-w-2xl">
                <MotionLockup className="mb-7 w-64 text-white" accent={ACCENT_ON_DARK} animated />

                <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-teal-950/50">
                    {sub && bank ? (
                        <PaymentDetails
                            heading="Access is paused, and your records are safe"
                            intro={intro}
                            workshopName={paused.workshopName}
                            planName={sub.planName}
                            {...summaryFor(sub.priceAmount)}
                            reference={sub.reference}
                            bank={bank}
                            supportEmail={reach}
                        />
                    ) : (
                        // No agreed amount on file (a workshop from before plans
                        // existed) or no bank details configured: nothing to
                        // print, so a person sorts it out rather than the page
                        // guessing at an amount.
                        <div>
                            <span className="grid h-11 w-11 place-items-center rounded-full bg-teal-50 text-teal-700">
                                <PauseCircle className="h-5 w-5" aria-hidden />
                            </span>
                            <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-slate-900">Access is paused, and your records are safe</h1>
                            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">{intro}</p>
                            <p className="mt-4 text-[14px] leading-relaxed text-slate-600">
                                Contact us for the amount due and the payment details. We will restore access as soon as the payment is
                                received.
                            </p>
                            {reach && (
                                <a
                                    href={`mailto:${reach}`}
                                    className="mt-4 inline-flex min-h-11 items-center text-[14px] font-medium text-teal-700 hover:underline"
                                >
                                    {reach}
                                </a>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 text-[13px]">
                    <Link href="/support" className="text-teal-100/70 hover:text-white">
                        Need help?
                    </Link>
                    <form action={logoutAction}>
                        <button type="submit" className="min-h-11 text-teal-100/70 hover:text-white">
                            Sign out
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}

function summaryFor(price: number) {
    const s = paymentSummary(price);
    return { exclusive: s.exclusive, inclusive: s.inclusive, vatRate: s.vatRate };
}
