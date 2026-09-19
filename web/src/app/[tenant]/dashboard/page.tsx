import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Car, Bell, CalendarDays } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { SetupChecklist } from "@/components/setup/SetupChecklist";
import { setupSteps } from "@/lib/setup/checklist";
import { setupFacts } from "@/lib/setup/queries";
import { dueReminders } from "@/lib/reminders/queries";

export default async function DashboardPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { tenant, db, membership } = await requireTenant(slug);
    const [customers, vehicles, reminders, bookings] = await Promise.all([
        db.customer.count({ where: { archivedAt: null } }),
        db.vehicle.count({ where: { archivedAt: null } }),
        dueReminders(db, tenant),
        db.document.count({ where: { type: "BOOKING", state: "DRAFT" } }),
    ]);
    const setup = can(membership, "settings:manage") ? setupSteps(await setupFacts(db, tenant), `/${slug}`) : null;
    const tiles = [
        { label: "Customers", value: customers, icon: Users, href: `/${slug}/dashboard/customers` },
        { label: "Vehicles", value: vehicles, icon: Car, href: `/${slug}/dashboard/vehicles` },
        { label: "Reminders to send", value: reminders.items.length, icon: Bell, href: `/${slug}/dashboard/reminders` },
        { label: "Open bookings", value: bookings, icon: CalendarDays, href: `/${slug}/dashboard/schedule` },
    ];
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
                <p className="text-sm text-slate-500">Sales, cost and profit will appear here once the first invoice is processed.</p>
            </div>
            {setup && <SetupChecklist steps={setup} />}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {tiles.map((t) => (
                    <Link key={t.label} href={t.href}>
                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{t.label}</CardTitle>
                                <t.icon className="h-4 w-4 text-slate-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold tabular-nums">{t.value}</div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
