"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CircleDot, CloudOff, X } from "lucide-react";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "@ui-sdk/react/drawer";
import { floorNotificationsAction, markAllReadAction, readNotificationAction } from "@/lib/notifications/actions";

type Note = { id: string; title: string; body: string | null; href: string; at: string; read: boolean };

const time = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The bell in the floor app's header and the list it opens, read on the floor
 * rather than on the office screen. A notice about a job opens that job's
 * sheet; anything else goes to its page.
 */
export function FloorNotifications({ tenant, unread: initialUnread, onOpenJob }: { tenant: string; unread: number; onOpenJob: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const [notes, setNotes] = useState<Note[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [unread, setUnread] = useState(initialUnread);
    const [, load] = useTransition();
    const router = useRouter();

    const fetchNotes = () =>
        load(async () => {
            try {
                const list = await floorNotificationsAction(tenant);
                setNotes(list);
                setUnread(list.filter((n) => !n.read).length);
                setFailed(false);
            } catch {
                setFailed(true);
            }
        });

    const openNote = (note: Note) => {
        if (!note.read) {
            setNotes((list) => list?.map((n) => (n.id === note.id ? { ...n, read: true } : n)) ?? null);
            setUnread((n) => Math.max(0, n - 1));
            readNotificationAction(tenant, note.id).catch(() => {});
        }
        const job = /^dashboard\/documents\/([^/?#]+)$/.exec(note.href);
        if (job) {
            setOpen(false);
            onOpenJob(job[1]);
        } else {
            router.push(`/${tenant}/${note.href}`);
        }
    };

    const label = unread ? `Notifications, ${unread} unread` : "Notifications";
    return (
        <Drawer open={open} onOpenChange={(next) => { setOpen(next); if (next) fetchNotes(); }} side="bottom">
            <DrawerTrigger aria-label={label} className="floor-press relative grid h-10 w-10 place-items-center rounded-sm border border-slate-600 text-white active:bg-slate-800">
                <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                {unread > 0 && (
                    <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-teal-600 px-1 text-center text-[11px] font-semibold leading-5 tabular-nums text-white">
                        {unread > 99 ? "99+" : unread}
                    </span>
                )}
            </DrawerTrigger>
            <DrawerBackdrop className="fixed inset-0 bg-slate-900/40" />
            <DrawerContent className="flex max-h-[85dvh] w-full flex-col border-t border-slate-300 bg-white">
                <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300" />
                <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-1">
                    <div>
                        <DrawerTitle className="text-lg font-semibold text-slate-900">Notifications</DrawerTitle>
                        <DrawerDescription className="text-sm text-slate-600">{unread ? `${unread} unread` : "Nothing unread"}</DrawerDescription>
                    </div>
                    <div className="flex items-center gap-1">
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setNotes((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
                                    setUnread(0);
                                    markAllReadAction(tenant).catch(() => {});
                                }}
                                className="floor-press h-11 rounded-sm px-2 text-sm font-medium text-teal-800 active:bg-slate-100"
                            >
                                Mark all as read
                            </button>
                        )}
                        <DrawerClose aria-label="Close notifications" className="floor-press -mr-2 grid h-11 w-11 place-items-center rounded-sm text-slate-600 active:bg-slate-100">
                            <X className="h-5 w-5" aria-hidden="true" />
                        </DrawerClose>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
                    {failed && !notes && (
                        <p className="mx-4 mb-4 flex items-start gap-2 border border-slate-300 px-3 py-3 text-base text-slate-800">
                            <CloudOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />Notifications need a signal. Try again when you have one.
                        </p>
                    )}
                    {notes && notes.length === 0 && <p className="px-4 pb-6 text-base text-slate-600">No notifications yet. Jobs you are put on, and vehicles on their way to where you work, appear here.</p>}
                    {notes && notes.length > 0 && (
                        <ul className="divide-y divide-slate-100 border-t border-slate-100">
                            {notes.map((n) => (
                                <li key={n.id}>
                                    <button type="button" onClick={() => openNote(n)} className="floor-press flex w-full items-start gap-3 px-4 py-3 text-left active:bg-slate-50">
                                        <span className="mt-1 h-3.5 w-3.5 shrink-0">{!n.read && <CircleDot className="h-3.5 w-3.5 text-teal-700" strokeWidth={2} aria-hidden="true" />}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className={`block text-base ${n.read ? "text-slate-700" : "font-semibold text-slate-900"}`}>
                                                {!n.read && <span className="sr-only">Unread: </span>}
                                                {n.title}
                                            </span>
                                            {n.body && <span className="block text-sm text-slate-600">{n.body}</span>}
                                            <time dateTime={n.at} className="block text-xs tabular-nums text-slate-600">{time(n.at)}</time>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
