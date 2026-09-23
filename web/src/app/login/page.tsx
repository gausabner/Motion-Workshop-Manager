import { redirect } from "next/navigation";
import { MotionLogo } from "@/components/brand/MotionLogo";
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
        <main className="min-h-svh bg-slate-100 flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-sm p-8">
                <MotionLogo className="h-7 w-auto text-slate-800 mb-6" />
                <h1 className="text-xl font-semibold text-slate-800 mb-1">Sign in</h1>
                <p className="text-sm text-slate-500 mb-6">Workshop Manager</p>
                <LoginForm next={next} />
            </div>
        </main>
    );
}
