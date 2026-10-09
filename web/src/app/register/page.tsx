import { MotionLogo } from "@/components/brand/MotionLogo";
import { requestOrigin } from "@/lib/http/origin";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Register your workshop | MOTION Workshop Manager" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
    const { plan } = await searchParams;
    // The address the workshop will actually sign in at — this server's own,
    // so a council's installation shows its host rather than ours.
    const host = new URL(await requestOrigin()).host;
    return (
        <main className="min-h-svh bg-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-8">
                <MotionLogo className="h-7 w-auto text-slate-800 mb-6" />
                <h1 className="text-xl font-semibold text-slate-800 mb-1">Register your workshop</h1>
                <p className="text-sm text-slate-500 mb-6">You will be the owner of this workshop&apos;s account. You can invite your staff after registering.</p>
                <RegisterForm host={host} initialPlan={plan} />
            </div>
        </main>
    );
}
