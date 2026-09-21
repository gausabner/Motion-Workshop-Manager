import Link from "next/link";
import { ArrowLeft, Inbox } from "lucide-react";
import { RequestCard } from "@/components/booking/RequestCard";
import { requireTenant } from "@/lib/auth/session";
import { bookingQueue } from "@/lib/bookings/queries";
import { onlineBookingSettings } from "@/lib/settings/schema";
import { formatLocalDateTime } from "@/lib/diary/time";

export const metadata = { title: "Booking requests | MOTION Workshop Manager" };

export default async function RequestsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant } = await requireTenant(slug);
    const { items, decided, mechanics } = await bookingQueue(db, tenant);
    const online = onlineBookingSettings(tenant.settings);

    return (
        <div className="max-w-5xl mx-auto space-y-4 pb-12">
            <Link href={`/${slug}/dashboard/schedule`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-700"><ArrowLeft className="w-3.5 h-3.5" />Back to the diary</Link>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800"><Inbox className="w-6 h-6 text-slate-400" />Booking requests</h1>
                <p className="text-xs text-slate-500">
                    {online.enabled
                        ? <>Customers book at <Link href={`/${slug}/book`} className="text-teal-700 hover:underline" target="_blank">/{slug}/book</Link></>
                        : <>Online booking is off — turn it on under <Link href={`/${slug}/dashboard/settings/booking`} className="text-teal-700 hover:underline">Settings → Bookings</Link></>}
                </p>
            </div>

            {items.length === 0 ? (
                <p className="rounded-sm border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No requests waiting.</p>
            ) : (
                <ul className="space-y-3">{items.map((item) => <RequestCard key={item.id} tenant={slug} item={item} mechanics={mechanics} />)}</ul>
            )}

            {decided.length > 0 && (
                <section className="border border-slate-200 rounded-sm bg-white">
                    <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recently decided</h2>
                    <ul className="divide-y divide-slate-100">
                        {decided.map((d) => (
                            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                                <span>
                                    <span className={d.status === "APPROVED" ? "font-medium text-teal-700" : "font-medium text-slate-500"}>{d.status === "APPROVED" ? "Approved" : "Declined"}</span>
                                    {" "}{d.firstName} {d.lastName} · {d.service} · {formatLocalDateTime(d.requestedAt, tenant.timezone).replace("T", " ")}
                                    {d.declineReason && <span className="text-slate-400"> — {d.declineReason}</span>}
                                </span>
                                {d.documentId && <Link href={`/${slug}/dashboard/documents/${d.documentId}`} className="text-xs text-teal-700 hover:underline">Booking</Link>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
