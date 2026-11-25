"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { unreadCountAction } from "@/lib/notifications/actions";

/**
 * The way to a person's notifications, with how many they have not opened.
 * The header is not drawn again on every screen, so the bell asks for its
 * number itself: on each move to another screen, and every minute.
 */
export function NotificationBell({ tenant }: { tenant: string }) {
    const pathname = usePathname();
    const [unread, setUnread] = useState(0);
    useEffect(() => {
        let live = true;
        const ask = () => unreadCountAction(tenant).then((n) => live && setUnread(n), () => {});
        ask();
        const every = setInterval(ask, 60_000);
        return () => {
            live = false;
            clearInterval(every);
        };
    }, [tenant, pathname]);
    const label = unread ? `Notifications, ${unread} unread` : "Notifications";
    return (
        <Link
            href={`/${tenant}/dashboard/notifications`}
            aria-label={label}
            title={label}
            className="relative hit-area flex h-8 w-8 items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
            <Bell aria-hidden strokeWidth={1.75} className="h-[18px] w-[18px]" />
            {unread > 0 && (
                <span aria-hidden className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-teal-700 px-1 text-center text-[10px] font-semibold leading-4 text-white tabular-nums">
                    {unread > 99 ? "99+" : unread}
                </span>
            )}
        </Link>
    );
}
