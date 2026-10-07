import Link from "next/link";
import type { ReactNode } from "react";
import { MotionLockup } from "@/components/brand/MotionLogo";
import { requirePlatformStaff } from "@/lib/admin/platform";
import { logoutAction } from "@/lib/auth/actions";

// No title. A title set here is sent before the staff check below rejects a
// visitor, so a signed-in non-staff user saw "Admin" in the tab for a moment
// before the 404 replaced it — the area confirming it exists, which is the one
// thing the 404 is for.
export const metadata = { robots: { index: false, follow: false } };

/**
 * MOTION's own back office.
 *
 * Not a workshop screen and deliberately not dressed as one: the people here
 * are MOTION Dynamic Systems' staff approving and managing customers, and a
 * band across the top saying so is what stops somebody who is also a workshop
 * owner losing track of which hat they have on.
 *
 * The staff check is in the layout so every page under /admin inherits it, and
 * a non-staff visitor gets a 404 — the area does not confirm it exists.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
    const staff = await requirePlatformStaff();

    return (
        <div className="min-h-dvh bg-slate-50">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
                    <div className="flex items-center gap-3">
                        <Link href="/admin" aria-label="MOTION admin, home">
                            <MotionLockup className="w-28 text-slate-900" />
                        </Link>
                        <span className="rounded-full bg-teal-950 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white">
                            Admin
                        </span>
                    </div>
                    <div className="flex items-center gap-4 text-[13px] text-slate-600">
                        <span className="hidden sm:inline">
                            {staff.firstName} {staff.lastName}
                        </span>
                        <form action={logoutAction}>
                            <button type="submit" className="min-h-9 text-slate-600 hover:text-slate-900">
                                Sign out
                            </button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
    );
}
