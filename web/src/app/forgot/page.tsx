import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ACCENT_ON_DARK, MotionLockup } from "@/components/brand/MotionLogo";
import { HeroField } from "@/components/public/HeroField";
import { ForgotForm } from "@/app/forgot/ForgotForm";

export const metadata = {
    title: "Forgot your password | MOTION Workshop Manager",
    description: "Send yourself a link to set a new MOTION password.",
};

/**
 * Starting the way back in.
 *
 * Same room as the sign-in page, deliberately: somebody arriving here has just
 * failed to sign in, and dropping them onto a differently-dressed page would
 * read as having been sent somewhere else. The only thing that changes is the
 * card.
 */
export default function ForgotPage() {
    return (
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-teal-950 p-6">
            <HeroField tone="deep" />

            <div className="relative z-10 w-full max-w-sm">
                <Link
                    href="/login"
                    className="group mb-6 inline-flex min-h-11 items-center gap-2 text-[13px] text-teal-100/70 motion-safe:transition-colors motion-safe:duration-150 hover:text-white"
                >
                    <ArrowLeft
                        className="h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-0.5"
                        strokeWidth={2}
                    />
                    Sign in
                </Link>

                <MotionLockup className="mb-7 w-64 text-white" accent={ACCENT_ON_DARK} animated />

                <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-teal-950/50">
                    <ForgotForm />
                </div>
            </div>
        </main>
    );
}
