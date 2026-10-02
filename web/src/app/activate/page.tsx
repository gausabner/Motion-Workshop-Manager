import { redirect } from "next/navigation";
import Link from "next/link";
import { ACCENT_ON_DARK, MotionLockup } from "@/components/brand/MotionLogo";
import { HeroField } from "@/components/public/HeroField";
import { StepProgress } from "@/components/auth/StepProgress";
import { PlanChooser, type ChoosablePlan } from "@/app/activate/PlanChooser";
import { PaymentDetails } from "@/app/activate/PaymentDetails";
import { requireUser, defaultTenantSlug } from "@/lib/auth/session";
import { pendingRegistrationFor, paymentSummary } from "@/lib/billing/registration";
import { bankDetails } from "@/lib/billing/config";
import { PLANS, VAT_RATE } from "@/lib/pricing/plans";
import { support } from "@/lib/edition";
import { logoutAction } from "@/lib/auth/actions";

export const metadata = {
    title: "Activate your workshop | MOTION Workshop Manager",
    description: "Choose a plan and pay to switch your workshop on.",
};

/** Three steps, because registering now crosses a bank and comes back. */
const REGISTER_STEPS = [
    { id: "workshop", label: "Your workshop" },
    { id: "plan", label: "Choose a plan" },
    { id: "pay", label: "Payment" },
] as const;

/**
 * The one page a workshop that has not paid can reach.
 *
 * Deliberately outside `/[tenant]`, like `/reset/[token]`. A tenant route would
 * have to pass `requireTenant`, which is the very thing redirecting people
 * here — a loop — and somebody who registered two minutes ago does not
 * reliably know their own slug yet.
 *
 * It decides what to show by reading the registration rather than by being told
 * through a query parameter: no plan chosen yet means the chooser, a plan chosen
 * means where to pay. So a bookmark, a reload and a fresh sign-in on another
 * device all land on the right screen, which matters because the gap between
 * those two states is however long a bank transfer takes.
 */
export default async function ActivatePage() {
    const user = await requireUser("/activate");
    const pending = await pendingRegistrationFor(user.id);

    // Nothing to pay for. Either they are already active — in which case this
    // page would be a dead end — or they have no workshop at all.
    if (!pending) {
        const slug = await defaultTenantSlug(user.id);
        redirect(slug ? `/${slug}/dashboard` : "/login");
    }

    const bank = bankDetails();
    const chosen = pending.subscription;

    return (
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-teal-950 p-6">
            <HeroField tone="deep" />

            <div className="relative z-10 w-full max-w-2xl">
                <MotionLockup className="mb-7 w-64 text-white" accent={ACCENT_ON_DARK} animated />

                <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-teal-950/50">
                    <StepProgress steps={REGISTER_STEPS} current={chosen ? "pay" : "plan"} />

                    <div className="mt-7">
                        {!bank ? (
                            // Configuration is missing, so there is nowhere to
                            // send anybody. Said plainly rather than shown as a
                            // half-filled bank panel: a customer who goes
                            // looking for the account number elsewhere is how
                            // people pay the wrong account.
                            <div>
                                <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Nearly there</h1>
                                <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                                    Your workshop is registered, but we cannot show you payment details right now. Please contact us
                                    and we will send them to you directly.
                                </p>
                                {support().email && (
                                    <a
                                        href={`mailto:${support().email}`}
                                        className="mt-4 inline-flex min-h-11 items-center text-[14px] font-medium text-teal-700 hover:underline"
                                    >
                                        {support().email}
                                    </a>
                                )}
                            </div>
                        ) : chosen ? (
                            <PaymentDetails
                                workshopName={pending.workshopName}
                                planName={chosen.planName}
                                {...summaryFor(chosen.priceAmount)}
                                reference={chosen.reference}
                                bank={bank}
                                supportEmail={support().email}
                            />
                        ) : (
                            <PlanChooser plans={choosablePlans()} vatRate={VAT_RATE} />
                        )}
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-4 text-[13px]">
                    <Link href="/support" className="text-teal-100/70 hover:text-white">
                        Need help?
                    </Link>
                    {/* A way out. Somebody signed in to a workshop that cannot be
                        used has no other navigation from here, and offering none
                        would strand them on this page. */}
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

/**
 * The tiers somebody can pick for themselves.
 *
 * Priced tiers only. "Council and multi-site" is quoted per site by a person,
 * so letting it be chosen here would mint a reference for an amount nobody has
 * agreed to — harder to unwind than to leave out.
 */
function choosablePlans(): ChoosablePlan[] {
    return PLANS.filter((p): p is typeof p & { price: number } => p.price !== null).map((plan) => {
        const s = paymentSummary(plan.price);
        return {
            id: plan.id,
            name: plan.name,
            who: plan.who,
            exclusive: s.exclusive,
            inclusive: s.inclusive,
            // Enough to tell the tiers apart without reprinting the pricing
            // page at somebody who has already decided to buy.
            includes: plan.includes.slice(0, 5),
        };
    });
}
