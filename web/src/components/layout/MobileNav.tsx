"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, LayoutDashboard, Menu, X } from "lucide-react";
import { Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@ui-sdk/react/drawer";
import { MotionLogo } from "@/components/brand/MotionLogo";
import { SidebarNav } from "@/components/layout/SidebarNav";
import type { Feature } from "@/lib/plans/features";

/**
 * Navigation for a phone: a bar at the bottom, and everything else in a drawer.
 *
 * The sidebar this replaces was 180px wide and never collapsed, which on a
 * 375px screen is 48% of the display permanently spent on navigation — the
 * content it left behind could not hold the sentence "owed to us for more than
 * 30 days" without breaking it across six lines.
 *
 * Four destinations sit at the bottom rather than the top because that is
 * where a thumb reaches on a phone held one-handed, and because the top of the
 * screen belongs to the notch. They are the things people actually open MOTION
 * on a phone to do: see what is waiting, check the diary, find a job. Nobody
 * builds a quote or runs a stock take standing in a car park, so those live
 * behind More with everything else.
 *
 * The drawer reuses `SidebarNav` exactly as the desktop sidebar does. The five
 * groups built for desktop were not wasted — they are what makes a drawer
 * navigable instead of a list of twenty.
 */

const TABS = [
    { href: "/dashboard", label: "Today", icon: LayoutDashboard, exact: true },
    { href: "/dashboard/schedule", label: "Diary", icon: CalendarDays },
    { href: "/dashboard/jobs", label: "Jobs", icon: ClipboardList },
] as const;

export function MobileNav({
    base,
    workshopName,
    reports,
    cost,
    manages,
    features,
}: {
    base: string;
    workshopName: string;
    reports: boolean;
    cost: boolean;
    manages: boolean;
    features: Feature[];
}) {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);

    const isActive = (href: string, exact?: boolean) => {
        const full = `${base}${href}`;
        return exact ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
    };
    // "More" carries the active state whenever the screen is not one of the
    // three tabs, so the bar always shows where you are rather than going blank.
    const onATab = TABS.some((t) => isActive(t.href, "exact" in t ? t.exact : false));

    // The drawer is modal: the page behind is inert and does not scroll, so
    // dragging the drawer never scrolls the list underneath instead.
    return (
        <Drawer open={open} onOpenChange={setOpen} side="left">
            {/* ── bottom bar ─────────────────────────────────────────── */}
            <nav
                aria-label="Main"
                className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] md:hidden"
            >
                {TABS.map((tab) => {
                    const active = isActive(tab.href, "exact" in tab ? tab.exact : false);
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.href}
                            href={`${base}${tab.href}`}
                            aria-current={active ? "page" : undefined}
                            className={`flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                                active ? "text-teal-700" : "text-slate-500"
                            }`}
                        >
                            <Icon className="h-5 w-5" aria-hidden="true" />
                            {tab.label}
                        </Link>
                    );
                })}
                <DrawerTrigger
                    className={`flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                        onATab ? "text-slate-500" : "text-teal-700"
                    }`}
                >
                    <Menu className="h-5 w-5" aria-hidden="true" />
                    More
                </DrawerTrigger>
            </nav>

            {/* ── drawer ─────────────────────────────────────────────── */}
            <DrawerBackdrop className="fixed inset-0 bg-slate-900/40 md:hidden" />
            <DrawerContent className="flex h-dvh w-[280px] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-[0_25px_50px_-12px_rgb(15_23_42/0.10)] md:hidden">
                <DrawerTitle className="sr-only">All screens</DrawerTitle>
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4 pt-[env(safe-area-inset-top,0px)]">
                    <MotionLogo className="h-[22px] w-auto" />
                    <DrawerClose
                        aria-label="Close menu"
                        className="relative hit-area -mr-2 grid h-10 w-10 place-items-center rounded-sm text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </DrawerClose>
                </div>
                <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Workshop</p>
                    <p className="truncate text-sm font-medium text-slate-800">{workshopName}</p>
                </div>
                {/* `contain` keeps this list's own bounce but stops the page
                    behind it moving when the list reaches its end. */}
                {/* Closing on the click that navigates, rather than on the
                    pathname changing afterwards: a drawer that survives
                    navigation is a trap — you tap a link, the page changes
                    underneath, and the drawer is still covering it. */}
                <div
                    onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}
                    className="flex-1 overflow-y-auto overscroll-contain py-1 pb-[env(safe-area-inset-bottom,0px)]"
                >
                    <SidebarNav base={base} reports={reports} cost={cost} manages={manages} features={features} />
                </div>
            </DrawerContent>
        </Drawer>
    );
}
