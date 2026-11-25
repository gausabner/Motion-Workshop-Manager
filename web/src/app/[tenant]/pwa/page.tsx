import type { Metadata, Viewport } from "next";
import { MechanicFloor } from "@/components/pwa/MechanicFloor";
import { requireTenant } from "@/lib/auth/session";
import { floorView } from "@/lib/time/queries";
import { unreadCount } from "@/lib/notifications/queries";
import { scheduleMonth } from "@/lib/time/floor-sheet";
import { toZoned } from "@/lib/diary/time";
import Link from "next/link";

export const metadata: Metadata = {
    title: "On the floor | MOTION",
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MOTION" },
};

// Zoom is left on: locking it stops anyone with less-than-perfect eyesight
// reading the screen. Inputs are 16px and up, so iOS does not zoom on focus anyway.
export const viewport: Viewport = { themeColor: "#0f172a", width: "device-width", initialScale: 1 };

export default async function FloorPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership, user } = await requireTenant(slug);
    const month = toZoned(new Date(), tenant.timezone).day.slice(0, 7);
    const [floor, unread, schedule] = await Promise.all([floorView(db, tenant, membership.id), unreadCount(db, membership.id), scheduleMonth(db, tenant, membership.id, month)]);

    if (!membership.isMechanic && !membership.showOnDiary) {
        return (
            <main className="min-h-svh bg-slate-100 px-4 py-12 text-center">
                <p className="mx-auto max-w-sm text-base text-slate-600">This is the mechanics&rsquo; clock, and you are not set up as a mechanic. Ask the workshop owner to mark you as a mechanic under Settings → Team.</p>
            </main>
        );
    }

    return (
        <>
        {/* Jobs they are put on already appear below; this says something new has come in, and where to read it. */}
        {unread > 0 && (
            <Link href={`/${slug}/dashboard/notifications`} className="block bg-teal-700 px-4 py-3 text-center text-base font-medium text-white">
                {unread === 1 ? "1 new notification" : `${unread} new notifications`}. Open them.
            </Link>
        )}
        <MechanicFloor
            tenant={slug}
            name={user.firstName}
            minutesToday={floor.minutesToday}
            running={floor.running ? { startedAt: floor.running.startedAt.toISOString(), job: floor.running.job, priorMinutes: floor.running.priorMinutes } : null}
            mine={floor.mine}
            others={floor.others}
            schedule={schedule}
            day={floor.day}
        />
        </>
    );
}
