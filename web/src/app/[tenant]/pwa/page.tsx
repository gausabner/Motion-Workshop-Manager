import type { Metadata, Viewport } from "next";
import { MechanicFloor } from "@/components/pwa/MechanicFloor";
import { requireTenant } from "@/lib/auth/session";
import { floorView } from "@/lib/time/queries";

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
    const floor = await floorView(db, tenant, membership.id);

    if (!membership.isMechanic && !membership.showOnDiary) {
        return (
            <main className="min-h-svh bg-slate-100 px-4 py-12 text-center">
                <p className="mx-auto max-w-sm text-base text-slate-600">This is the mechanics&rsquo; clock. You are not set up as a mechanic — ask the workshop owner to mark you as one under Admin → Mechanics.</p>
            </main>
        );
    }

    return (
        <MechanicFloor
            tenant={slug}
            name={user.firstName}
            minutesToday={floor.minutesToday}
            running={floor.running ? { startedAt: floor.running.startedAt.toISOString(), job: floor.running.job } : null}
            mine={floor.mine}
            others={floor.others}
        />
    );
}
