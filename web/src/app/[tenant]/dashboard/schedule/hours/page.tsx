import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WorkingHoursGrid } from "@/components/diary/WorkingHoursGrid";
import { TimeOffPanel } from "@/components/diary/TimeOffPanel";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { diaryMechanics } from "@/lib/diary/queries";
import { diarySettings } from "@/lib/settings/schema";
import { formatLocalDateTime } from "@/lib/diary/time";

export const metadata = { title: "Hours and leave | MOTION Workshop Manager" };

export default async function HoursPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    const settings = diarySettings(tenant.settings);
    const mechanics = await diaryMechanics(db);
    const ids = mechanics.map((m) => m.id);

    const [overrides, timeOff] = await Promise.all([
        db.workingHours.findMany({ where: { membershipId: { in: ids } }, select: { membershipId: true, weekday: true, startMinute: true, endMinute: true } }),
        db.timeOff.findMany({ where: { membershipId: { in: ids }, endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 50, select: { id: true, membershipId: true, startsAt: true, endsAt: true, reason: true } }),
    ]);
    const names = new Map(mechanics.map((m) => [m.id, m.name]));
    const show = (d: Date) => formatLocalDateTime(d, tenant.timezone).replace("T", " ");

    return (
        <div className="max-w-6xl mx-auto space-y-4 pb-12">
            <Link href={`/${slug}/dashboard/schedule`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"><ArrowLeft className="w-3.5 h-3.5" />Back to the diary</Link>
            <div>
                <h1 className="text-xl font-bold text-slate-800">Hours and leave</h1>
                <p className="text-sm text-slate-500">What the diary counts as available time. The shop&rsquo;s own hours are set under Settings → Bookings.</p>
            </div>
            <WorkingHoursGrid
                tenant={slug}
                mechanics={mechanics}
                overrides={overrides}
                shop={{ opensAt: settings.opensAt, closesAt: settings.closesAt, workingDays: settings.workingDays }}
                canEdit={can(membership, "settings:manage")}
            />
            <TimeOffPanel
                tenant={slug}
                mechanics={mechanics}
                entries={timeOff.map((t) => ({ id: t.id, name: names.get(t.membershipId) ?? "—", from: show(t.startsAt), to: show(t.endsAt), reason: t.reason }))}
                canEdit={can(membership, "documents:write")}
            />
        </div>
    );
}
