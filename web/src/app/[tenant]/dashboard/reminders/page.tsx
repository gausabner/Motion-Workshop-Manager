import Link from "next/link";
import type { ReminderKind } from "@prisma/client";
import { requireTenant } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { dueReminders, recentReminders, type DueReminder } from "@/lib/reminders/queries";
import { KIND_LABELS, KIND_NOUNS, KIND_ORDER, relativeDay } from "@/lib/reminders/rules";
import { SendDialog } from "@/components/messaging/SendDialog";
import { SkipButton, UnskipButton } from "@/components/reminders/SkipButton";
import { dateShort, dateShortIn } from "@/lib/format";

export const metadata = { title: "Reminders | MOTION Workshop Manager" };

const WHAT: Record<ReminderKind, string> = {
    SERVICE_DUE: "Service due",
    LICENCE_DISC: "Disc expires",
    ROADWORTHY: "Roadworthy expires",
    BOOKING: "Booked for",
    QUOTE_FOLLOW_UP: "Follow up",
};

/**
 * Who to remind today. Worked out afresh on every visit from the vehicles,
 * bookings and quotes, so there is no job to schedule and nothing to go stale:
 * send one and it leaves the list; move a service date and it comes back.
 */
export default async function RemindersPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, tenant, membership } = await requireTenant(slug);
    const [{ today, items, optedOut }, recent] = await Promise.all([dueReminders(db, tenant), recentReminders(db)]);
    const canSend = can(membership, "messages:send");
    const byKind = new Map<ReminderKind, DueReminder[]>();
    for (const item of items) byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item]);

    return (
        <div className="space-y-6 max-w-5xl pb-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Reminders</h1>
                    <p className="text-sm text-slate-500">
                        {items.length === 0 ? "Nobody to remind today." : `${items.length} to send. Each one opens ready-worded on WhatsApp or email.`}
                        {optedOut > 0 && ` ${optedOut} more left out because the customer opted out of messages.`}
                    </p>
                </div>
                {can(membership, "settings:manage") && (
                    <Link href={`/${slug}/dashboard/settings/messaging#reminders`} className="text-sm font-medium text-teal-700 hover:underline">When reminders go out, and their wording</Link>
                )}
            </div>

            {items.length === 0 && (
                <p className="rounded-sm border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
                    Reminders come from the next-service, licence disc and roadworthy dates on each vehicle, from bookings in the diary, and from quotes that have gone out.
                    Fill those dates in as vehicles come through, and this list fills itself.
                </p>
            )}

            {KIND_ORDER.filter((k) => byKind.has(k)).map((kind) => (
                <section key={kind} className="border border-slate-200 rounded-sm bg-white">
                    <h2 className="flex items-center justify-between px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <span>{KIND_LABELS[kind]}</span><span className="tabular-nums">{byKind.get(kind)!.length}</span>
                    </h2>
                    <ul className="divide-y divide-slate-100">
                        {byKind.get(kind)!.map((r) => {
                            const overdue = r.showOn < today;
                            return (
                                <li key={`${r.kind}:${r.targetId}:${r.dueOn}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <Link href={`/${slug}/dashboard/customers/${r.customer.id}`} className="text-sm font-medium text-slate-800 hover:underline">{r.customer.name}</Link>
                                        <p className="text-xs text-slate-500 truncate">
                                            {r.vehicle ? `${r.vehicle.plate} · ${r.vehicle.description}` : ""}
                                            {r.document && <> · <Link href={`/${slug}/dashboard/documents/${r.document.id}`} className="hover:underline">{r.document.number ?? "draft"}</Link></>}
                                            {!r.customer.mobile && !r.customer.email && <span className="text-amber-700"> · no mobile or email on file</span>}
                                        </p>
                                    </div>
                                    <p className={`text-xs tabular-nums ${overdue ? "text-amber-700" : "text-slate-600"}`}>
                                        {WHAT[r.kind]} {dateShort(new Date(`${r.showOn}T00:00:00Z`))} <span className="text-slate-400">({relativeDay(r.showOn, today)})</span>
                                    </p>
                                    {canSend && (
                                        <div className="flex items-center gap-1">
                                            <SendDialog tenant={slug} target={{ kind: "REMINDER", reminder: r.kind, targetId: r.targetId, dueOn: r.dueOn }} label={`reminder to ${r.customer.name}`} />
                                            <SkipButton tenant={slug} reminder={{ kind: r.kind, targetId: r.targetId, dueOn: r.dueOn }} />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}

            {recent.length > 0 && (
                <section className="border border-slate-200 rounded-sm bg-white">
                    <h2 className="px-4 py-2 border-b bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recently done</h2>
                    <ul className="divide-y divide-slate-100 text-sm">
                        {recent.map((r) => (
                            <li key={r.id} className="flex flex-wrap items-center gap-x-3 px-4 py-2">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${r.outcome === "SENT" ? "text-teal-700" : "text-slate-400"}`}>
                                    {r.outcome === "SENT" ? (r.message?.status === "HANDED_OFF" ? "Handed off" : "Sent") : "Skipped"}
                                </span>
                                <span className="text-slate-700">{KIND_NOUNS[r.kind]}</span>
                                <span className="text-slate-500">
                                    {r.customer ? `${r.customer.firstName} ${r.customer.lastName}` : ""}{r.vehicle ? ` · ${r.vehicle.plate}` : ""}{r.document?.number ? ` · ${r.document.number}` : ""}
                                </span>
                                <span className="ml-auto text-xs text-slate-400">
                                    {r.actedBy?.user.firstName ?? ""} · {dateShortIn(r.actedAt, tenant.timezone)}
                                </span>
                                {r.outcome === "SKIPPED" && canSend && <UnskipButton tenant={slug} reminderId={r.id} />}
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
