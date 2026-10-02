import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MotionLockup } from "@/components/brand/MotionLogo";
import { AuthArt } from "@/components/public/AuthArt";
import { getSessionUser, signedInLanding } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in | MOTION Workshop Manager" };

/**
 * The door a customer opens every morning.
 *
 * Light, and two columns: the form on the left, the isometric object on the
 * right. It was a dark full-bleed card over the hero field, which looked well
 * at eight in the evening and read as a different product from the landing
 * page it was reached from — the landing page is white, and arriving somewhere
 * dark says "you have left".
 *
 * The artwork column disappears below `md`. On a phone the form is the whole
 * screen, which is right: a picture that pushes the password field below the
 * fold is a picture that costs somebody a sign-in.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    const { next } = await searchParams;
    const user = await getSessionUser();
    if (user) redirect(await signedInLanding(user.id));

    return (
        <div className="grid min-h-svh md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* The form column is its own grid so the footer sits on the floor
                rather than wherever the form happens to end — a short form and
                a long one should not move the small print. */}
            <div className="grid grid-rows-[auto_1fr_auto] px-6 pt-6 sm:px-10 lg:px-20">
                <header className="flex items-center justify-between gap-4">
                    <Link href="/" aria-label="MOTION, home">
                        <MotionLockup className="w-36 text-slate-900" />
                    </Link>
                    <Link
                        href="/"
                        className="group inline-flex min-h-11 items-center gap-1.5 text-[14px] font-medium text-slate-900 hover:text-teal-700"
                    >
                        <ArrowLeft
                            className="h-4 w-4 motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-x-0.5"
                            strokeWidth={2}
                        />
                        Back
                    </Link>
                </header>

                <main className="flex w-full max-w-sm flex-col justify-center gap-6 py-16">
                    <div>
                        <h1 className="text-[clamp(2.25rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-slate-900">
                            Sign in
                        </h1>
                        <p className="mt-2 text-[18px] text-slate-500">Your workshop, where you left it.</p>
                    </div>
                    <LoginForm next={next} />
                </main>

                <footer className="flex flex-wrap items-center justify-between gap-x-6 border-t border-slate-200 py-2 text-[13px] text-slate-500">
                    <ul className="flex flex-wrap gap-x-5">
                        {[
                            ["/help", "Help"],
                            ["/support", "Support"],
                            ["/terms", "Terms"],
                            ["/privacy", "Privacy"],
                        ].map(([href, label]) => (
                            <li key={href}>
                                <Link href={href} className="inline-flex min-h-11 items-center hover:text-slate-900">
                                    {label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <small>
                        © <span className="tabular-nums">{new Date().getFullYear()}</span> MOTION Workshop Manager
                    </small>
                </footer>
            </div>

            <AuthArt />
        </div>
    );
}
