import Link from "next/link";
import { MotionLogo } from "@/components/brand/MotionLogo";
import { GROUP_LABELS } from "@/lib/auth/permissions";
import { findInvitation } from "@/lib/team/service";
import { JoinForm } from "./JoinForm";

export const metadata = { title: "Join a workshop | MOTION Workshop Manager", robots: { index: false } };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const invitation = await findInvitation(token);
    return (
        <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-8">
                <MotionLogo className="h-7 w-auto text-slate-800 mb-6" />
                {invitation ? (
                    <>
                        <h1 className="text-xl font-semibold text-slate-800 mb-1">Join {invitation.tenant.name}</h1>
                        <p className="text-sm text-slate-500 mb-6">
                            As {GROUP_LABELS[invitation.group]}, signing in as <span className="font-medium text-slate-700">{invitation.email}</span>.
                        </p>
                        <JoinForm token={token} hasAccount={invitation.hasAccount} />
                    </>
                ) : (
                    <>
                        <h1 className="text-xl font-semibold text-slate-800 mb-2">This link no longer works</h1>
                        <p className="text-sm text-slate-500">
                            Invitations last 7 days and work once. Ask the workshop to send you a new one — or, if you have already joined, sign in.
                        </p>
                        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-teal-700 hover:underline">Go to sign in</Link>
                    </>
                )}
            </div>
        </main>
    );
}
