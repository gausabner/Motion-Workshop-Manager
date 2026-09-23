import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { forTenant } from "@/lib/tenant-db";
import { bookableDays } from "@/lib/bookings/availability";
import { onlineBookingSettings } from "@/lib/settings/schema";
import { minuteLabel, parseMinute } from "@/lib/diary/time";
import { dayHeading } from "@/components/diary/shared";
import { PublicBookingForm } from "@/components/booking/PublicBookingForm";

/**
 * Online booking (R4). Four short steps — service, day, time, details — each
 * a plain link, so it works on any phone on any connection and the browser's
 * back button always does what the customer expects.
 *
 * It shows times, never who is booked in them.
 */

export async function generateMetadata({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { name: true } });
    return { title: tenant ? `Book a service | ${tenant.name}` : "Book a service", robots: { index: false } };
}

const hoursLabel = (minutes: number) => {
    const h = minutes / 60;
    return h < 1 ? `${minutes} min` : `${Number.isInteger(h) ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
};

export default async function BookPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ type?: string; day?: string; time?: string }> }) {
    const [{ tenant: slug }, sp] = await Promise.all([params, searchParams]);
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant?.isActive) notFound();
    const online = onlineBookingSettings(tenant.settings);
    const db = forTenant(tenant.id);
    const base = `/${slug}/book`;

    const shell = (children: React.ReactNode, back?: string) => (
        <main className="min-h-svh bg-slate-100 px-4 py-8">
            <div className="mx-auto max-w-lg space-y-5">
                <header className="text-center">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Book a service</p>
                    <h1 className="text-2xl font-bold text-slate-800">{tenant.name}</h1>
                    {tenant.city && <p className="text-sm text-slate-500">{tenant.city}</p>}
                </header>
                {back && <Link href={back} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"><ArrowLeft className="w-4 h-4" />Back</Link>}
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">{children}</section>
            </div>
        </main>
    );

    if (!online.enabled) {
        return shell(
            <p className="text-center text-slate-600">
                Online booking is not open at the moment.{tenant.phone ? <> Phone us on <a href={`tel:${tenant.phone}`} className="font-semibold text-teal-700">{tenant.phone}</a>.</> : null}
            </p>,
        );
    }

    const types = await db.appointmentType.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, description: true, estimatedHours: true } });
    const type = types.find((t) => t.id === sp.type);

    // Step 1 — what needs doing.
    if (!type) {
        return shell(
            <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800"><Wrench className="w-5 h-5 text-teal-600" />What does the car need?</h2>
                <ul className="space-y-2">
                    {types.map((t) => (
                        <li key={t.id}>
                            <Link href={`${base}?type=${t.id}`} className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 hover:border-teal-500 hover:bg-teal-50">
                                <span className="font-medium text-slate-800">{t.description}</span>
                                <span className="text-sm text-slate-500">about {hoursLabel(Math.round(t.estimatedHours.toNumber() * 60))}</span>
                            </Link>
                        </li>
                    ))}
                </ul>
                {types.length === 0 && <p className="text-slate-600">No services are open for online booking yet.</p>}
            </div>,
        );
    }

    const minutes = Math.max(15, Math.round(type.estimatedHours.toNumber() * 60));
    const days = await bookableDays(db, tenant, minutes);
    const day = days.find((d) => d.day === sp.day && d.slots.length > 0);

    // Step 2 — which day.
    if (!day) {
        const open = days.filter((d) => d.open);
        return shell(
            <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800"><CalendarDays className="w-5 h-5 text-teal-600" />{type.description} — which day?</h2>
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {open.map((d) =>
                        d.slots.length ? (
                            <li key={d.day}>
                                <Link href={`${base}?type=${type.id}&day=${d.day}`} className="block rounded-md border border-slate-200 px-3 py-2.5 text-center hover:border-teal-500 hover:bg-teal-50">
                                    <span className="block text-sm font-semibold text-slate-800">{dayHeading(d.day, "short")}</span>
                                    <span className="block text-xs text-teal-700">{d.slots.length} time{d.slots.length === 1 ? "" : "s"}</span>
                                </Link>
                            </li>
                        ) : (
                            <li key={d.day} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5 text-center">
                                <span className="block text-sm text-slate-400">{dayHeading(d.day, "short")}</span>
                                <span className="block text-xs text-slate-400">{d.full ? "Full" : "No time left"}</span>
                            </li>
                        ),
                    )}
                </ul>
                {open.every((d) => d.slots.length === 0) && <p className="text-slate-600">Nothing is free in the next {online.horizonDays} days for this job. {tenant.phone && <>Phone us on <a href={`tel:${tenant.phone}`} className="font-semibold text-teal-700">{tenant.phone}</a>.</>}</p>}
            </div>,
            base,
        );
    }

    const minute = parseMinute(sp.time ?? "");
    // Step 3 — what time.
    if (minute === null || !day.slots.includes(minute)) {
        return shell(
            <div className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800"><Clock className="w-5 h-5 text-teal-600" />{dayHeading(day.day)} — what time?</h2>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {day.slots.map((s) => (
                        <li key={s}>
                            <Link href={`${base}?type=${type.id}&day=${day.day}&time=${minuteLabel(s)}`} className="block rounded-md border border-slate-200 py-2.5 text-center font-medium tabular-nums text-slate-800 hover:border-teal-500 hover:bg-teal-50">
                                {minuteLabel(s)}
                            </Link>
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-slate-500">Bring the car in at this time. The job takes about {hoursLabel(minutes)}.</p>
            </div>,
            `${base}?type=${type.id}`,
        );
    }

    // Step 4 — who you are.
    return shell(
        <div className="space-y-4">
            <div className="rounded-md bg-teal-50 px-4 py-3 text-sm text-teal-900">
                <p className="font-semibold">{type.description}</p>
                <p>{dayHeading(day.day)} at {minuteLabel(minute)}</p>
            </div>
            <PublicBookingForm slug={slug} type={type.id} day={day.day} time={minuteLabel(minute)} />
        </div>,
        `${base}?type=${type.id}&day=${day.day}`,
    );
}
