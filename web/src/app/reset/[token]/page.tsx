import Link from "next/link";
import { LinkIcon } from "lucide-react";
import { ACCENT_ON_DARK, MotionLockup } from "@/components/brand/MotionLogo";
import { HeroField } from "@/components/public/HeroField";
import { ResetProgress } from "@/components/auth/ResetProgress";
import { SetPasswordForm } from "@/components/settings/SetPasswordForm";
import { findPasswordReset } from "@/lib/team/recovery";

export const metadata = { title: "Set a new password | MOTION Workshop Manager" };

/**
 * Where a self-service link lands.
 *
 * Deliberately not under `/[tenant]`. The existing admin-issued route is, which
 * is right for a link handed over in person by somebody who knows the
 * workshop — but a person who has forgotten their password does not reliably
 * know their workshop's slug, and asking them to supply it to reach a password
 * form would be absurd. The token already names exactly one workshop, so it
 * resolves itself.
 */
export default async function SelfResetPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const reset = await findPasswordReset(token);

    return (
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-teal-950 p-6">
            <HeroField tone="deep" />

            <div className="relative z-10 w-full max-w-sm">
                <MotionLockup className="mb-7 w-64 text-white" accent={ACCENT_ON_DARK} animated />

                <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-teal-950/50">
                    {reset ? (
                        <>
                            <ResetProgress current="set" />
                            <h1 className="mt-7 text-[22px] font-semibold tracking-tight text-slate-900">Set a new password</h1>
                            <p className="mb-6 mt-1 text-[14px] text-slate-500">
                                For {reset.user.firstName} at {reset.tenant.name}.
                            </p>
                            <SetPasswordForm token={token} slug={reset.tenant.slug} />
                        </>
                    ) : (
                        // A dead link says so rather than showing a form that
                        // will fail on submit. Somebody arriving here has
                        // already had one thing go wrong today.
                        <div className="text-center">
                            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
                                <LinkIcon className="h-5 w-5" aria-hidden />
                            </span>
                            <h1 className="mt-4 text-[20px] font-semibold tracking-tight text-slate-900">This link has expired</h1>
                            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
                                A reset link works once and lasts an hour. Ask for another and use the newest email — an older link stops
                                working the moment a new one is sent.
                            </p>
                            <Link
                                href="/forgot"
                                className="mt-6 inline-flex min-h-11 items-center text-[14px] font-medium text-teal-700 hover:underline"
                            >
                                Send a new link
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
