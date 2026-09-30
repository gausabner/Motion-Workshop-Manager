import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ACCENT_ON_DARK, MotionLockup } from "@/components/brand/MotionLogo";
import { getSessionUser, defaultTenantSlug } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in | MOTION Workshop Manager" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    const { next } = await searchParams;
    const user = await getSessionUser();
    if (user) {
        const slug = await defaultTenantSlug(user.id);
        redirect(slug ? `/${slug}/dashboard` : "/register");
    }
    return (
        /**
         * The same dark ground as the front door, so signing in feels like
         * stepping through rather than landing somewhere else. The card itself
         * stays white and square-cornered: it is a form, and the product
         * behind it is a ledger page.
         */
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-teal-950 p-6">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage:
                        "radial-gradient(50rem 28rem at 50% -6rem, rgba(45,212,191,0.18), transparent 70%), radial-gradient(34rem 20rem at 80% 90%, rgba(13,148,136,0.12), transparent 65%)",
                }}
            />

            <div className="relative z-10 w-full max-w-sm">
                <Link
                    href="/"
                    className="group mb-6 inline-flex items-center gap-2 text-[13px] text-teal-100/70 motion-safe:transition-colors motion-safe:duration-150 hover:text-white"
                >
                    <ArrowLeft
                        className="h-3.5 w-3.5 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-0.5"
                        strokeWidth={2}
                    />
                    Back
                </Link>

                {/* Above the card rather than inside it. The lockup carries a
                    tagline, and inside a 384px card it renders at four pixels
                    tall — present, and unreadable. Out here it has the width,
                    and it is the one place in the product where the whole mark
                    earns an entrance: seen once, at the moment somebody
                    arrives. */}
                <MotionLockup className="mb-7 w-64 text-white" accent={ACCENT_ON_DARK} animated />

                <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-teal-950/50">
                    <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Sign in</h1>
                    <p className="mb-7 mt-1 text-[14px] text-slate-500">Your workshop, where you left it.</p>
                    <LoginForm next={next} />
                </div>

                {/* No "register" link here: the form already carries one, and
                    two of them a centimetre apart saying the same thing is the
                    kind of duplication that makes a reader distrust both. */}
            </div>
        </main>
    );
}
