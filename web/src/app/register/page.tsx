import { MotionLogo } from "@/components/brand/MotionLogo";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Create your workshop | MOTION Workshop Manager" };

export default function RegisterPage() {
    return (
        <main className="min-h-svh bg-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-sm p-8">
                <MotionLogo className="h-7 w-auto text-slate-800 mb-6" />
                <h1 className="text-xl font-semibold text-slate-800 mb-1">Create your workshop</h1>
                <p className="text-sm text-slate-500 mb-6">You will be the owner. Invite advisors and mechanics afterwards.</p>
                <RegisterForm />
            </div>
        </main>
    );
}
