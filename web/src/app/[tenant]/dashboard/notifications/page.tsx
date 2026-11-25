import { Bell, CircleDot } from "lucide-react";
import { requireTenant } from "@/lib/auth/session";
import { notificationsFor } from "@/lib/notifications/queries";
import { markAllReadAction, openNotificationAction } from "@/lib/notifications/actions";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Notifications | MOTION Workshop Manager" };

/**
 * What wants this person's attention: vehicles on their way to where they
 * work, and jobs they have been put on. Opening one marks it read and goes to
 * the job card.
 */
export default async function NotificationsPage({ params }: { params: Promise<{ tenant: string }> }) {
    const { tenant: slug } = await params;
    const { db, membership, tenant } = await requireTenant(slug);
    const notes = await notificationsFor(db, membership.id);
    const unread = notes.filter((n) => !n.readAt).length;
    const when = (d: Date) => d.toLocaleString("en-GB", { timeZone: tenant.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold tracking-[-0.01em] text-slate-900">Notifications</h1>
                    <p className="text-sm text-slate-600">{unread ? `${unread} unread.` : "Nothing unread."} Vehicles on their way to where you work, and jobs you have been put on.</p>
                </div>
                {unread > 0 && (
                    <form action={markAllReadAction.bind(null, slug)}>
                        <Button type="submit" size="sm" variant="outline">Mark all as read</Button>
                    </form>
                )}
            </div>
            {notes.length === 0 ? (
                <div className="border border-slate-200 bg-white px-4 py-10 text-center">
                    <Bell aria-hidden strokeWidth={1.5} className="mx-auto h-6 w-6 text-slate-500" />
                    <p className="mt-2 text-sm text-slate-700">No notifications yet.</p>
                    <p className="text-sm text-slate-600">When a vehicle is sent to where you work, or you are put on a job, it appears here.</p>
                </div>
            ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 bg-white">
                    {notes.map((n) => (
                        <li key={n.id}>
                            <form action={openNotificationAction.bind(null, slug, n.id)}>
                                <button type="submit" className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none">
                                    <span className="mt-1 h-3.5 w-3.5 shrink-0">
                                        {!n.readAt && <CircleDot aria-hidden strokeWidth={2} className="h-3.5 w-3.5 text-teal-700" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className={`block text-sm ${n.readAt ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                                            {!n.readAt && <span className="sr-only">Unread: </span>}
                                            {n.title}
                                        </span>
                                        {n.body && <span className="block text-sm text-slate-600">{n.body}</span>}
                                    </span>
                                    <time dateTime={n.createdAt.toISOString()} className="shrink-0 text-xs tabular-nums text-slate-500">{when(n.createdAt)}</time>
                                </button>
                            </form>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
