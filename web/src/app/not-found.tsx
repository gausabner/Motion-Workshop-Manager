import Link from "next/link";
import { MotionLogo } from "@/components/brand/MotionLogo";

export const metadata = { title: "Page not found | MOTION Workshop Manager" };

/**
 * The last 404, for anything no nearer `not-found` catches.
 *
 * Without it the framework's own page shows — a bare "404 | This page could not
 * be found" in a system font, with no way back. That is what a workshop owner
 * saw when "New customer" broke in front of a prospective customer, and it
 * looked like the product had fallen over rather than one link being wrong.
 */
export default function NotFound() {
    return (
        <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
            <div className="w-full max-w-md text-center">
                <MotionLogo className="mx-auto h-8 w-auto" />
                <h1 className="mt-8 text-xl font-bold text-slate-900">Page not found</h1>
                <p className="mt-2 text-base text-slate-600">
                    This page does not exist. It may have been moved, or the address may be mistyped.
                </p>
                <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <Link href="/login" className="inline-flex h-11 items-center rounded-sm bg-teal-700 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-teal-800">
                        Go to your workshop
                    </Link>
                    <Link href="/" className="inline-flex h-11 items-center px-3 text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900">
                        MOTION home
                    </Link>
                </div>
            </div>
        </main>
    );
}
