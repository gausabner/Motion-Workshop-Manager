import { notFound } from "next/navigation";
import { BookingSettingsForm } from "@/components/settings/BookingSettingsForm";
import { AppointmentTypes } from "@/components/settings/AppointmentTypes";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { diarySettingsSchema, parseSettings } from "@/lib/settings/schema";

export const metadata = { title: "Bookings | MOTION Workshop Manager" };

export default async function BookingSettingsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    if (!can(membership, "settings:manage")) notFound();
    const parsed = diarySettingsSchema.safeParse(parseSettings(tenant.settings).diary ?? {});
    const diary = parsed.success ? parsed.data : diarySettingsSchema.parse({});
    const types = await db.appointmentType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, description: true, estimatedHours: true, active: true } });

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-medium">Bookings</h3>
                <p className="text-sm text-slate-500">Opening hours and how the booking diary measures a full day.</p>
            </div>
            <div className="border-t border-slate-200" />
            <BookingSettingsForm tenant={slug} diary={diary} />
            <AppointmentTypes tenant={slug} types={types.map((t) => ({ ...t, estimatedHours: t.estimatedHours.toNumber() }))} />
        </div>
    );
}
