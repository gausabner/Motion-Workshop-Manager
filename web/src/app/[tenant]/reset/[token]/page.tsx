import Link from "next/link";
import { KeyRound, LinkIcon } from "lucide-react";
import { findPasswordReset } from "@/lib/team/recovery";
import { SetPasswordForm } from "@/components/settings/SetPasswordForm";

export const metadata = { title: "Set a password | MOTION Workshop Manager" };

/**
 * Where a reset link lands.
 *
 * Signed out by definition, so it lives outside the dashboard entirely — and a
 * dead link says so plainly rather than showing a form that will fail. Somebody
 * arriving here has already had one thing go wrong today.
 */
export default async function ResetPage({ params }: { params: Promise<{ tenant: string; token: string }> }) {
    const { tenant: slug, token } = await params;
    const reset = await findPasswordReset(token);

    if (!reset) {
        return (
            <main className="grid min-h-svh place-items-center bg-slate-100 p-6">
                <div className="w-full max-w-sm space-y-3 rounded-lg bg-white p-6 text-center shadow-sm">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
                        <LinkIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h1 className="text-lg font-bold text-slate-800">This link has expired</h1>
                    <p className="text-sm text-slate-600">
                        Reset links work once and last a day. Ask whoever sent it for another — it takes them a moment.
                    </p>
                    <Link href={`/${slug}/dashboard`} className="inline-block pt-1 text-sm font-medium text-teal-700">
                        Go to sign in
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="grid min-h-svh place-items-center bg-slate-100 p-6">
            <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow-sm">
                <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800">
                    <KeyRound className="h-4 w-4 text-teal-600" aria-hidden="true" />
                    Set a new password
                </h1>
                <p className="text-sm text-slate-600">
                    {reset.user.firstName}, this is for <strong className="font-medium text-slate-800">{reset.user.email}</strong> at {reset.tenant.name}.
                    Choose something only you know.
                </p>
                <SetPasswordForm token={token} slug={slug} />
            </div>
        </main>
    );
}
